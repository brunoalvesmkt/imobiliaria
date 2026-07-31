import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { ALL_DOMAIN_EVENTS, type DomainEventName, type DomainEventPayload } from "../common/events/domain-event.types";
import { evaluateConditions, type AutomationCondition } from "./automation-definition.types";
import { AutomationProducer } from "./automation.producer";

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

    for (const automation of automations) {
      const condicoes = automation.condicoes as unknown as AutomationCondition[] | null;
      if (!evaluateConditions(payload.data, condicoes)) {
        continue;
      }

      const execution = await this.prisma.automationExecution.create({
        data: {
          tenantId: payload.tenantId,
          automationId: automation.id,
          contactId: payload.contactId ?? null,
          conversationId: payload.conversationId ?? null,
          gatilhoDisparado: gatilhoTipo,
          status: "pending",
        },
      });

      await this.producer.enqueueExecution(execution.id);
    }
  }
}
