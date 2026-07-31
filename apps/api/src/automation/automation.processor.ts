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
import type { AutomationAction } from "./automation-definition.types";

interface RunExecutionJobData {
  executionId: string;
}

interface SendFollowUpJobData {
  followUpId: string;
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
    if (!execution || execution.status === "success" || execution.status === "dead_letter") {
      return; // já processada com sucesso ou definitivamente falhou — idempotência (caso crítico #8)
    }

    await this.prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: "running", tentativas: { increment: 1 } },
    });

    const automation = await this.prisma.automation.findUniqueOrThrow({ where: { id: execution.automationId } });
    const acoes = automation.acoes as unknown as AutomationAction[];
    const executed: unknown[] = [];

    try {
      for (const acao of acoes) {
        const result = await this.executeAction(automation.tenantId, execution, acao, automation.webhookSecret);
        executed.push({ tipo: acao.tipo, result });
      }

      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: "success", executedAt: new Date(), acoesExecutadas: executed as Prisma.InputJsonValue },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attemptsMax = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade + 1 >= attemptsMax;

      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: isFinalAttempt ? "dead_letter" : "failed", erro: message },
      });

      if (isFinalAttempt) {
        this.logger.error(`Automação ${automation.id} foi para dead-letter: ${message}`);
      }
      throw error; // deixa o BullMQ decidir o retry conforme attempts/backoff
    }
  }

  private async sendFollowUp(job: Job<SendFollowUpJobData>): Promise<void> {
    const followUp = await this.prisma.followUpSchedule.findUnique({ where: { id: job.data.followUpId } });
    if (!followUp || followUp.status !== "scheduled") {
      return; // cancelado ou já enviado
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

  private async executeAction(
    tenantId: string,
    execution: AutomationExecution,
    acao: AutomationAction,
    webhookSecret: string | null,
  ): Promise<unknown> {
    switch (acao.tipo) {
      case "send_message": {
        if (!execution.conversationId) return { skipped: "sem conversationId" };
        return this.sendConversationMessage(tenantId, execution.conversationId, acao.texto, "system");
      }

      case "create_task": {
        if (!execution.contactId) return { skipped: "sem contactId" };
        const dataHora = new Date(Date.now() + (acao.horasParaVencer ?? 24) * 3_600_000);
        const task = await this.prisma.crmTask.create({
          data: {
            tenantId,
            contactId: execution.contactId,
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
        if (!execution.contactId) return { skipped: "sem contactId" };
        const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: execution.contactId } });
        const tags =
          acao.tipo === "apply_tag"
            ? Array.from(new Set([...contact.tags, acao.tag]))
            : contact.tags.filter((t) => t !== acao.tag);
        await this.prisma.contact.update({ where: { id: contact.id }, data: { tags } });
        return { tags };
      }

      case "update_field": {
        if (!execution.contactId) return { skipped: "sem contactId" };
        const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: execution.contactId } });
        const customFields = { ...((contact.customFields as Record<string, unknown> | null) ?? {}), [acao.campo]: acao.valor };
        await this.prisma.contact.update({ where: { id: contact.id }, data: { customFields: customFields as Prisma.InputJsonValue } });
        return { campo: acao.campo };
      }

      case "move_opportunity_stage": {
        if (!execution.contactId) return { skipped: "sem contactId" };
        const opportunity = await this.prisma.opportunity.findFirst({
          where: { contactId: execution.contactId, status: "open" },
          orderBy: { createdAt: "desc" },
        });
        if (!opportunity) return { skipped: "sem oportunidade aberta" };
        await this.prisma.opportunity.update({ where: { id: opportunity.id }, data: { stageId: acao.stageId } });
        return { opportunityId: opportunity.id };
      }

      case "start_chatbot": {
        if (!execution.conversationId) return { skipped: "sem conversationId" };
        const chatbotExecution = await this.chatbotEngine.startFlow(acao.flowId, execution.conversationId);
        return { chatbotExecutionId: chatbotExecution.id };
      }

      case "send_webhook": {
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
        const followUp = await this.followUps.schedule({
          tenantId,
          automationId: execution.automationId,
          contactId: execution.contactId,
          conversationId: execution.conversationId,
          delayMinutes: acao.delayMinutes,
          texto: acao.texto,
          sequenciaIndex: acao.sequenciaIndex ?? 0,
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
}
