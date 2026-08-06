import { Logger } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { AutomationExecution, Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { ProviderRegistryService } from "../whatsapp/providers/provider-registry.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ChatbotEngineService } from "../chatbot/engine/chatbot-engine.service";
import { FollowUpsService } from "./followups.service";
import { stripDddiBrasil } from "../crm/contacts/phone.util";
import { evaluateConditions, type AutomationAction, type AutomationCondition } from "./automation-definition.types";
import { runWithAutomationChain } from "./automation-chain-context";

interface RunExecutionJobData {
  executionId: string;
  chainDepth?: number;
}

/** Acima desta idade, uma execução travada em "running" é considerada órfã (worker derrubado no meio) e pode ser reprocessada — folga confortável acima do lock padrão do BullMQ. */
const STALE_RUNNING_MS = 120_000;

interface SendFollowUpJobData {
  followUpId: string;
}

/** Um passo do histórico detalhado (`AutomationExecution.acoesExecutadas`) — gravado tanto no sucesso quanto na falha, para que as ações que rodaram antes de um erro não se percam (ver Fase D). */
export interface ExecutedStep {
  tipo: string;
  status: "success" | "error";
  result?: unknown;
  erro?: string;
  iniciadoEm: string;
  concluidoEm: string;
}

/**
 * Consumidor real da fila "automations" — roda no processo da API (não em
 * `apps/worker`) porque as ações reutilizam serviços já existentes
 * (ProviderRegistryService, ChatbotEngineService) que vivem aqui; mover
 * para um processo separado exigiria extrair essas dependências para um
 * pacote compartilhado, o que não se justifica nesta fase.
 */
@Processor("automations")
export class AutomationProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly realtime: RealtimeGateway,
    private readonly chatbotEngine: ChatbotEngineService,
    private readonly followUps: FollowUpsService,
  ) {
    super();
  }

  async process(job: Job<RunExecutionJobData | SendFollowUpJobData, unknown, string>): Promise<void> {
    if (job.name === "run_execution") {
      await this.runExecution(job as Job<RunExecutionJobData>);
      return;
    }
    if (job.name === "send_followup") {
      await this.sendFollowUp(job as Job<SendFollowUpJobData>);
      return;
    }
  }

  private async runExecution(job: Job<RunExecutionJobData>): Promise<void> {
    const execution = await this.prisma.automationExecution.findUnique({ where: { id: job.data.executionId } });
    if (!execution) return;
    if (execution.status === "success" || execution.status === "dead_letter") {
      return; // já processada com sucesso ou definitivamente falhou — idempotência (caso crítico #8)
    }
    if (execution.status === "running" && Date.now() - execution.updatedAt.getTime() < STALE_RUNNING_MS) {
      return; // outra execução deste mesmo job já está em andamento — duplicata concorrente legítima
    }

    await this.prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: "running", tentativas: { increment: 1 } },
    });

    const automation = await this.prisma.automation.findUniqueOrThrow({ where: { id: execution.automationId } });
    const acoes = automation.acoes as unknown as AutomationAction[];
    const executed: ExecutedStep[] = [];

    // Resolvido uma única vez por execução (mesmo quando o gatilho não tinha contactId — ex.:
    // "Mensagem recebida" na primeira conversa de um número novo, contactId só existe depois que
    // algo vincula o contato) e reaproveitado por todas as ações desta automação que precisam dele.
    const contactId = await this.resolveContactId(automation.tenantId, execution);

    // A profundidade da corrente (ver automation-chain-context.ts) fica disponível dentro deste
    // contexto assíncrono para o AutomationEngineService.dispatch, caso uma ação (ex.: start_chatbot)
    // dispare sincronamente um novo evento de domínio que reentre no motor de automações.
    await runWithAutomationChain({ executionId: execution.id, depth: job.data.chainDepth ?? 0 }, async () => {
      try {
        for (const acao of acoes) {
          const iniciadoEm = new Date().toISOString();
          try {
            const result = await this.executeAction(automation.tenantId, execution, acao, automation.webhookSecret, contactId);
            executed.push({ tipo: acao.tipo, status: "success", result, iniciadoEm, concluidoEm: new Date().toISOString() });
          } catch (actionError) {
            executed.push({
              tipo: acao.tipo,
              status: "error",
              erro: actionError instanceof Error ? actionError.message : String(actionError),
              iniciadoEm,
              concluidoEm: new Date().toISOString(),
            });
            throw actionError; // propaga pro catch externo, que decide failed/dead_letter conforme attempts
          }
        }

        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: { status: "success", executedAt: new Date(), acoesExecutadas: executed as unknown as Prisma.InputJsonValue },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attemptsMax = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade + 1 >= attemptsMax;

        // Grava o que já rodou até aqui (Fase D) — antes só o sucesso persistia acoesExecutadas,
        // então uma falha na 2ª ação de 3 escondia o resultado real da 1ª.
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: { status: isFinalAttempt ? "dead_letter" : "failed", erro: message, acoesExecutadas: executed as unknown as Prisma.InputJsonValue },
        });

        if (isFinalAttempt) {
          this.logger.error(`Automação ${automation.id} foi para dead-letter: ${message}`);
        }
        throw error; // deixa o BullMQ decidir o retry conforme attempts/backoff
      }
    });
  }

  private async sendFollowUp(job: Job<SendFollowUpJobData>): Promise<void> {
    const followUp = await this.prisma.followUpSchedule.findUnique({ where: { id: job.data.followUpId } });
    if (!followUp || followUp.status !== "scheduled") {
      return; // cancelado ou já enviado
    }

    // Espera com revalidação: o tempo entre agendar e disparar pode ter tornado a automação inativa
    // ou as condições que a originaram não valem mais — sem isso, um follow-up seguia enviando mesmo
    // depois de o usuário pausar/arquivar a automação ou o estado mudar.
    const automation = await this.prisma.automation.findUnique({ where: { id: followUp.automationId } });
    if (!automation || automation.status !== "active") {
      await this.prisma.followUpSchedule.update({
        where: { id: followUp.id },
        data: { status: "cancelled", canceladoPorEvento: "automation_inactive" },
      });
      return;
    }

    const condicoes = automation.condicoes as unknown as AutomationCondition[] | null;
    if (!evaluateConditions((followUp.dadosGatilho as Record<string, unknown> | null) ?? {}, condicoes)) {
      await this.prisma.followUpSchedule.update({
        where: { id: followUp.id },
        data: { status: "cancelled", canceladoPorEvento: "condition_no_longer_met" },
      });
      return;
    }

    await this.prisma.followUpSchedule.update({ where: { id: followUp.id }, data: { status: "sent" } });

    if (!followUp.conversationId) {
      return;
    }

    const conversation = await this.prisma.conversation.findUnique({ where: { id: followUp.conversationId } });
    if (!conversation || conversation.status === "closed") {
      return;
    }

    await this.sendConversationMessage(followUp.tenantId, conversation.id, followUp.mensagem, "system");
  }

  // ---------------------------------------------------------------------

  /**
   * Roda todas as ações de uma automação em modo simulado (nenhuma escrita real, nenhuma chamada
   * externa) e devolve o resultado passo-a-passo — usado por `AutomationsService.simulate()`, que
   * roda síncrono na resposta HTTP (sem fila, sem `AutomationExecution` criada: não é uma execução
   * de verdade, é só "o que aconteceria"). Uma ação simulada com erro não impede as seguintes de
   * rodar (diferente da execução real) — o objetivo aqui é mostrar o cenário completo de uma vez.
   */
  async simulateActions(
    tenantId: string,
    acoes: AutomationAction[],
    webhookSecret: string | null,
    contactId: string | null,
    conversationId: string | null,
    automationId: string,
    gatilhoDisparado: string,
  ): Promise<ExecutedStep[]> {
    const fakeExecution: Pick<AutomationExecution, "conversationId" | "contactId" | "automationId" | "gatilhoDisparado" | "dadosGatilho"> = {
      conversationId,
      contactId,
      automationId,
      gatilhoDisparado,
      dadosGatilho: null,
    };

    const executed: ExecutedStep[] = [];
    for (const acao of acoes) {
      const iniciadoEm = new Date().toISOString();
      try {
        const result = await this.executeAction(tenantId, fakeExecution, acao, webhookSecret, contactId, true);
        executed.push({ tipo: acao.tipo, status: "success", result, iniciadoEm, concluidoEm: new Date().toISOString() });
      } catch (error) {
        executed.push({
          tipo: acao.tipo,
          status: "error",
          erro: error instanceof Error ? error.message : String(error),
          iniciadoEm,
          concluidoEm: new Date().toISOString(),
        });
      }
    }
    return executed;
  }

  private async executeAction(
    tenantId: string,
    execution: Pick<AutomationExecution, "conversationId" | "contactId" | "automationId" | "gatilhoDisparado" | "dadosGatilho">,
    acao: AutomationAction,
    webhookSecret: string | null,
    contactId: string | null,
    simulate = false,
  ): Promise<unknown> {
    switch (acao.tipo) {
      case "send_message": {
        if (!execution.conversationId) return { skipped: "sem conversationId" };
        if (simulate) return { simulado: true, enviariaMensagem: acao.texto };
        return this.sendConversationMessage(tenantId, execution.conversationId, acao.texto, "system");
      }

      case "create_task": {
        if (!contactId) return { skipped: "sem contato vinculável (sem conversationId nem contactId)" };
        const dataHora = new Date(Date.now() + (acao.horasParaVencer ?? 24) * 3_600_000);
        if (simulate) return { simulado: true, criariaTarefa: { titulo: acao.titulo, tipo: acao.tipoTarefa, dataHora } };
        const task = await this.prisma.crmTask.create({
          data: {
            tenantId,
            contactId,
            tipo: acao.tipoTarefa,
            titulo: acao.titulo,
            dataHora,
            status: "pending",
          },
        });
        return { taskId: task.id };
      }

      case "apply_tag":
      case "remove_tag": {
        if (!contactId) return { skipped: "sem contato vinculável (sem conversationId nem contactId)" };
        const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
        const tags =
          acao.tipo === "apply_tag"
            ? Array.from(new Set([...contact.tags, acao.tag]))
            : contact.tags.filter((t) => t !== acao.tag);
        if (simulate) return { simulado: true, deixariaTagsComo: tags };
        await this.prisma.contact.update({ where: { id: contact.id }, data: { tags } });
        return { tags };
      }

      case "update_field": {
        if (!contactId) return { skipped: "sem contato vinculável (sem conversationId nem contactId)" };
        const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
        const customFields = { ...((contact.customFields as Record<string, unknown> | null) ?? {}), [acao.campo]: acao.valor };
        if (simulate) return { simulado: true, campo: acao.campo, definiriaComo: acao.valor };
        await this.prisma.contact.update({ where: { id: contact.id }, data: { customFields: customFields as Prisma.InputJsonValue } });
        return { campo: acao.campo };
      }

      case "move_opportunity_stage": {
        if (!contactId) return { skipped: "sem contato vinculável (sem conversationId nem contactId)" };
        const crmFlag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
        if (!crmFlag?.enabled) return { skipped: "módulo CRM não habilitado" };

        const stage = await this.prisma.funnelStage.findFirst({ where: { id: acao.stageId, funnel: { tenantId } } });
        if (!stage) return { skipped: "etapa não encontrada" };

        // Mesma regra do card "Etapa do funil" do chatbot (ChatbotEngineService.addToCrmStage):
        // reaproveita a oportunidade aberta no mesmo funil se existir, senão cria uma nova — "mover
        // etapa" nunca deveria depender de o lead já ter uma oportunidade criada por outro caminho.
        const existing = await this.prisma.opportunity.findFirst({
          where: { tenantId, contactId, funnelId: stage.funnelId, status: "open", deletedAt: null },
        });
        if (simulate) return { simulado: true, moveriaParaEtapa: stage.nome, criariaOportunidade: !existing };
        if (existing) {
          if (existing.stageId === acao.stageId) return { opportunityId: existing.id };
          await this.prisma.opportunity.update({
            where: { id: existing.id },
            data: { stageId: acao.stageId, probabilidade: stage.probabilidade },
          });
          await this.closeOpenStageHistory(existing.id);
          await this.prisma.opportunityStageHistory.create({ data: { tenantId, opportunityId: existing.id, stageId: acao.stageId } });
          return { opportunityId: existing.id };
        }

        const opportunity = await this.prisma.opportunity.create({
          data: { tenantId, contactId, funnelId: stage.funnelId, stageId: acao.stageId, probabilidade: stage.probabilidade, origem: "automacao" },
        });
        await this.prisma.opportunityStageHistory.create({ data: { tenantId, opportunityId: opportunity.id, stageId: acao.stageId } });
        return { opportunityId: opportunity.id, created: true };
      }

      case "create_opportunity": {
        if (!contactId) return { skipped: "sem contato vinculável (sem conversationId nem contactId)" };
        const crmFlag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
        if (!crmFlag?.enabled) return { skipped: "módulo CRM não habilitado" };

        const stage = await this.prisma.funnelStage.findFirst({ where: { id: acao.stageId, funnel: { tenantId } } });
        if (!stage) return { skipped: "etapa não encontrada" };
        if (simulate) return { simulado: true, criariaOportunidadeNaEtapa: stage.nome };

        // Ao contrário de move_opportunity_stage (que reaproveita a oportunidade aberta no mesmo
        // funil se existir), esta ação SEMPRE cria uma nova — é o pedido explícito de "criar
        // oportunidade", não "garantir que o contato esteja em alguma etapa deste funil".
        const opportunity = await this.prisma.opportunity.create({
          data: { tenantId, contactId, funnelId: stage.funnelId, stageId: acao.stageId, probabilidade: stage.probabilidade, origem: "automacao" },
        });
        await this.prisma.opportunityStageHistory.create({ data: { tenantId, opportunityId: opportunity.id, stageId: acao.stageId } });
        return { opportunityId: opportunity.id };
      }

      case "start_chatbot": {
        if (!execution.conversationId) return { skipped: "sem conversationId" };
        if (simulate) return { simulado: true, iniciariaFluxo: acao.flowId };
        const chatbotExecution = await this.chatbotEngine.startFlow(acao.flowId, execution.conversationId);
        return { chatbotExecutionId: chatbotExecution.id };
      }

      case "send_webhook": {
        const metodo = acao.metodo ?? "POST";
        if (simulate) return { simulado: true, chamariaWebhook: acao.url, metodo };
        if (metodo === "GET") {
          // Requisição GET não carrega corpo — não faz sentido assinar (HMAC) um body vazio.
          const response = await fetch(acao.url, { method: "GET" });
          return { status: response.status };
        }

        const body = JSON.stringify({
          automationId: execution.automationId,
          contactId: execution.contactId,
          conversationId: execution.conversationId,
          gatilho: execution.gatilhoDisparado,
        });
        // Assinatura HMAC-SHA256 do corpo (Fase 28) — mesmo padrão dos
        // webhooks que a própria plataforma recebe (Meta, Stripe), invertido:
        // aqui é a plataforma quem assina para o destino externo verificar.
        // `webhookSecret` só falta em automações criadas antes desta fase.
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (webhookSecret) {
          const signature = createHmac("sha256", webhookSecret).update(body).digest("hex");
          headers["X-Automation-Signature"] = `sha256=${signature}`;
        }
        const response = await fetch(acao.url, { method: "POST", headers, body });
        return { status: response.status };
      }

      case "schedule_followup": {
        if (simulate) return { simulado: true, agendariaFollowUp: { delayMinutes: acao.delayMinutes, texto: acao.texto } };
        const followUp = await this.followUps.schedule({
          tenantId,
          automationId: execution.automationId,
          contactId,
          conversationId: execution.conversationId,
          delayMinutes: acao.delayMinutes,
          texto: acao.texto,
          sequenciaIndex: acao.sequenciaIndex ?? 0,
          dadosGatilho: execution.dadosGatilho as Prisma.InputJsonValue | null,
        });
        return { followUpId: followUp.id };
      }

      default:
        return { skipped: "tipo de ação desconhecido" };
    }
  }

  private async sendConversationMessage(
    tenantId: string,
    conversationId: string,
    texto: string,
    senderType: string,
  ): Promise<{ skipped: string } | { messageId: string }> {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    const number = await this.prisma.whatsAppNumber.findUniqueOrThrow({ where: { id: conversation.whatsAppNumberId } });

    if (number.modalidade === "unofficial") {
      const accepted = await this.prisma.riskAcceptance.findFirst({ where: { whatsAppNumberId: number.id } });
      if (!accepted) {
        return { skipped: "aceite de risco pendente" };
      }
    }

    if (conversation.contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: conversation.contactId }, select: { bloqueado: true } });
      if (contact?.bloqueado) {
        return { skipped: "contato bloqueado" };
      }
    }

    const provider = this.providers.resolve(number.provider);
    const result = await provider.sendMessage(
      { id: number.id, tenantId: number.tenantId, numero: number.numero, externalAccountId: number.externalAccountId },
      conversation.contatoNumero,
      { tipo: "text", texto },
    );

    const message = await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: "out",
        senderType,
        tipo: "text",
        conteudo: texto,
        externalId: result.externalId,
        statusEntrega: "sent",
      },
    });

    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
    this.realtime.emitToTenant(tenantId, "conversation:message", { conversationId, message });

    return { messageId: message.id };
  }

  /**
   * O gatilho "Mensagem recebida" (e outros baseados em conversa) não garante `contactId` — uma
   * conversa nova só ganha `Contact` vinculado quando algo cria esse vínculo explicitamente (ver
   * ChatbotEngineService.resolveContactId, mesmo princípio replicado aqui por não valer a pena
   * importar o módulo do Chatbot só por isto). Sem isso, ações como "Mover etapa da oportunidade"
   * ou "Criar tarefa" ficavam sempre puladas silenciosamente na primeira mensagem de um número novo.
   */
  private async resolveContactId(tenantId: string, execution: AutomationExecution): Promise<string | null> {
    if (execution.contactId) return execution.contactId;
    if (!execution.conversationId) return null;

    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: execution.conversationId } });
    if (conversation.contactId) return conversation.contactId;

    const existing = await this.prisma.contact.findFirst({
      where: { tenantId, whatsapp: conversation.contatoNumero, deletedAt: null },
    });
    const contact =
      existing ??
      (await this.prisma.contact.create({
        data: { tenantId, nome: "Sem Identificação", whatsapp: conversation.contatoNumero, origem: "automacao" },
      }));
    if (!existing) {
      await this.prisma.contactPhone.create({
        data: { contactId: contact.id, numero: stripDddiBrasil(conversation.contatoNumero), tipo: "whatsapp", principal: true },
      });
    }
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { contactId: contact.id } });
    return contact.id;
  }

  /** Fecha a linha de histórico "aberta" (sem exitedAt) da etapa atual — mesma lógica de OpportunitiesService/ChatbotEngineService, duplicada aqui pelo mesmo motivo do comentário acima. */
  private async closeOpenStageHistory(opportunityId: string): Promise<void> {
    const open = await this.prisma.opportunityStageHistory.findFirst({
      where: { opportunityId, exitedAt: null },
      orderBy: { enteredAt: "desc" },
    });
    if (open) {
      await this.prisma.opportunityStageHistory.update({ where: { id: open.id }, data: { exitedAt: new Date() } });
    }
  }
}
