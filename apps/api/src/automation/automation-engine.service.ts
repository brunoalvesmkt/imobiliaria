import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { ALL_DOMAIN_EVENTS, type DomainEventName, type DomainEventPayload } from "../common/events/domain-event.types";
import { evaluateConditions, MAX_AUTOMATION_CHAIN_DEPTH, type AutomationCondition } from "./automation-definition.types";
import { AutomationProducer } from "./automation.producer";
import { getCurrentAutomationChainDepth, isInsideAutomationChain } from "./automation-chain-context";

/**
 * Assina todos os eventos de domínio conhecidos e, para cada automação
 * ativa cujo gatilho combine, cria a `AutomationExecution` (estado
 * "pending") e enfileira o processamento — a fila (BullMQ) é quem garante
 * retry/backoff/dead-letter (ver ACCEPTANCE_CRITERIA.md).
 */
@Injectable()
export class AutomationEngineService implements OnModuleInit {
  private readonly logger = new Logger(AutomationEngineService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly prisma: PrismaService,
    private readonly producer: AutomationProducer,
  ) {}

  onModuleInit(): void {
    for (const eventName of ALL_DOMAIN_EVENTS) {
      this.emitter.on(eventName, (payload: DomainEventPayload) => {
        this.dispatch(eventName, payload).catch((error: unknown) => {
          this.logger.error(`Falha ao despachar automações para "${eventName}": ${String(error)}`);
        });
      });
    }
  }

  private async dispatch(gatilhoTipo: DomainEventName, payload: DomainEventPayload): Promise<void> {
    const automations = await this.prisma.automation.findMany({
      where: { tenantId: payload.tenantId, gatilhoTipo, status: "active" },
    });

    // Se este dispatch está acontecendo dentro da execução de OUTRA automação (ex.: a ação
    // start_chatbot concluiu um fluxo sincronamente e emitiu um novo evento de domínio), a
    // profundidade sobe mais um nível — usado para cortar correntes A→B→A antes que virem loop
    // infinito (ver automation-chain-context.ts).
    const nextDepth = isInsideAutomationChain() ? getCurrentAutomationChainDepth() + 1 : 0;

    for (const automation of automations) {
      const condicoes = automation.condicoes as unknown as AutomationCondition[] | null;
      if (!evaluateConditions(payload.data, condicoes)) {
        continue;
      }

      const baseData = {
        tenantId: payload.tenantId,
        automationId: automation.id,
        contactId: payload.contactId ?? null,
        conversationId: payload.conversationId ?? null,
        gatilhoDisparado: gatilhoTipo,
        chainDepth: nextDepth,
      };

      if (nextDepth > MAX_AUTOMATION_CHAIN_DEPTH) {
        this.logger.warn(`Automação ${automation.id} bloqueada por profundidade de corrente excedida (${nextDepth}) — possível loop entre automações.`);
        await this.prisma.automationExecution.create({
          data: {
            ...baseData,
            status: "loop_blocked",
            erro: `Corrente de automações excedeu a profundidade máxima (${MAX_AUTOMATION_CHAIN_DEPTH}) — bloqueada para evitar loop infinito.`,
          },
        });
        continue;
      }

      const throttleKey = payload.contactId ?? payload.conversationId ?? null;
      if (automation.cooldownMinutos && throttleKey) {
        const since = new Date(Date.now() - automation.cooldownMinutos * 60_000);
        const recent = await this.prisma.automationExecution.findFirst({
          where: {
            automationId: automation.id,
            createdAt: { gte: since },
            status: { in: ["pending", "running", "success"] },
            OR: [{ contactId: throttleKey }, { conversationId: throttleKey }],
          },
        });
        if (recent) {
          await this.prisma.automationExecution.create({ data: { ...baseData, status: "throttled" } });
          continue;
        }
      }

      const execution = await this.prisma.automationExecution.create({
        data: { ...baseData, status: "pending", dadosGatilho: payload.data as Prisma.InputJsonValue },
      });

      await this.producer.enqueueExecution(execution.id, nextDepth);
    }
  }
}
