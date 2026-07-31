import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { DomainEventName, DomainEventPayload } from "../common/events/domain-event.types";
import { NotificationsService } from "./notifications.service";

/**
 * Traduz um subconjunto dos eventos de domínio (ver `domain-event.types.ts`)
 * em notificações in-app (prompt mestre §6: "nova conversa", "nova
 * transferência", "retorno atrasado", "número desconectado" etc.). Mesmo
 * padrão de assinatura do `AutomationEngineService`, mas aqui cada evento
 * mapeia para uma mensagem fixa em vez de regras configuráveis pelo tenant.
 */
@Injectable()
export class NotificationsListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    const handlers: Partial<Record<DomainEventName, (payload: DomainEventPayload) => Promise<void>>> = {
      "conversation.created": (payload) =>
        this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: null,
            tipo: "conversation.created",
            titulo: "Nova conversa",
            corpo: "Uma nova conversa chegou na central de atendimento.",
            link: payload.conversationId ? `/painel/atendimento?conversationId=${payload.conversationId}` : null,
          })
          .then(() => undefined),
      "conversation.transferred": (payload) => {
        const responsavelId = (payload.data["responsavelId"] as string | null) ?? null;
        return this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: responsavelId,
            tipo: "conversation.transferred",
            titulo: "Nova transferência",
            corpo: responsavelId ? "Uma conversa foi transferida para você." : "Uma conversa foi transferida para uma fila.",
            link: payload.conversationId ? `/painel/atendimento?conversationId=${payload.conversationId}` : null,
          })
          .then(() => undefined);
      },
      "whatsapp_number.disconnected": (payload) => {
        const numero = payload.data["numero"] as string | undefined;
        return this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: null,
            tipo: "whatsapp_number.disconnected",
            titulo: "Número desconectado",
            corpo: numero ? `O número ${numero} foi desconectado.` : "Um número de WhatsApp foi desconectado.",
            link: "/painel/whatsapp/numeros",
            critical: true,
          })
          .then(() => undefined);
      },
      "crm_task.overdue": (payload) => {
        const responsavelId = (payload.data["responsavelId"] as string | null) ?? null;
        const titulo = payload.data["titulo"] as string | undefined;
        return this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: responsavelId,
            tipo: "crm_task.overdue",
            titulo: "Retorno atrasado",
            corpo: titulo ? `O retorno "${titulo}" está atrasado.` : "Um retorno está atrasado.",
            link: "/painel/crm/tarefas",
            critical: true,
          })
          .then(() => undefined);
      },
      "contact.lead_hot": (payload) => {
        const nome = payload.data["nome"] as string | undefined;
        return this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: null,
            tipo: "contact.lead_hot",
            titulo: "Lead quente",
            corpo: nome ? `${nome} atingiu pontuação de lead quente.` : "Um lead atingiu pontuação de lead quente.",
            link: payload.contactId ? `/painel/crm/contatos/${payload.contactId}` : null,
            critical: true,
          })
          .then(() => undefined);
      },
      "conversation.analysis_completed": (payload) => {
        const notaGeral = payload.data["notaGeral"] as number | undefined;
        return this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: null,
            tipo: "conversation.analysis_completed",
            titulo: "Análise concluída",
            corpo: notaGeral !== undefined ? `A análise de atendimento com IA foi concluída (nota ${notaGeral}).` : "A análise de atendimento com IA foi concluída.",
            link: payload.conversationId ? `/painel/atendimento/inbox?conversationId=${payload.conversationId}` : null,
          })
          .then(() => undefined);
      },
      "invoice.overdue": (payload) =>
        this.notifications
          .create({
            tenantId: payload.tenantId,
            recipientUserId: null,
            tipo: "invoice.overdue",
            titulo: "Fatura vencida",
            corpo: "Existe uma fatura vencida para esta empresa.",
            link: "/painel/financeiro",
            critical: true,
          })
          .then(() => undefined),
    };

    for (const [eventName, handler] of Object.entries(handlers) as [DomainEventName, (payload: DomainEventPayload) => Promise<void>][]) {
      this.emitter.on(eventName, (payload: DomainEventPayload) => {
        handler(payload).catch((error: unknown) => {
          this.logger.error(`Falha ao gerar notificação para "${eventName}": ${String(error)}`);
        });
      });
    }
  }
}
