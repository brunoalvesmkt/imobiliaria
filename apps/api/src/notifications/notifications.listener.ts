import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { DomainEventName, DomainEventPayload } from "../common/events/domain-event.types";
import { NotificationsService } from "./notifications.service";
import { NotificationTemplatesService } from "./notification-templates.service";

interface HandlerResult {
  tipo: string;
  recipientUserId?: string | null;
  values: Record<string, string>;
  link: string | null;
}

/**
 * Traduz um subconjunto dos eventos de domínio (ver `domain-event.types.ts`) em notificações in-app
 * (prompt mestre §6: "nova conversa", "nova transferência", "retorno atrasado", "número desconectado"
 * etc.). Cada handler só resolve os DADOS do evento (destinatário, link, valores dos placeholders) —
 * o texto (título/corpo) e se é "crítico" (também dispara WhatsApp administrativo) vêm de
 * `NotificationTemplatesService.render()`, que já aplica o override do tenant quando existir (ver
 * `notification-types.ts` para os textos padrão e a lista de placeholders de cada tipo).
 */
@Injectable()
export class NotificationsListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly notifications: NotificationsService,
    private readonly templates: NotificationTemplatesService,
  ) {}

  onModuleInit(): void {
    const handlers: Partial<Record<DomainEventName, (payload: DomainEventPayload) => HandlerResult>> = {
      "conversation.created": (payload) => ({
        tipo: "conversation.created",
        recipientUserId: null,
        values: {},
        link: payload.conversationId ? `/painel/atendimento?conversationId=${payload.conversationId}` : null,
      }),
      "conversation.transferred": (payload) => {
        const responsavelId = (payload.data["responsavelId"] as string | null) ?? null;
        return {
          tipo: "conversation.transferred",
          recipientUserId: responsavelId,
          values: { destino: responsavelId ? "você" : "uma fila" },
          link: payload.conversationId ? `/painel/atendimento?conversationId=${payload.conversationId}` : null,
        };
      },
      "whatsapp_number.disconnected": (payload) => {
        const numero = payload.data["numero"] as string | undefined;
        return {
          tipo: "whatsapp_number.disconnected",
          recipientUserId: null,
          values: { numero: numero ?? "desconhecido" },
          link: "/painel/whatsapp/numeros",
        };
      },
      "crm_task.overdue": (payload) => {
        const responsavelId = (payload.data["responsavelId"] as string | null) ?? null;
        const titulo = payload.data["titulo"] as string | undefined;
        return {
          tipo: "crm_task.overdue",
          recipientUserId: responsavelId,
          values: { titulo: titulo ?? "sem título" },
          link: "/painel/crm/tarefas",
        };
      },
      "contact.lead_hot": (payload) => {
        const nome = payload.data["nome"] as string | undefined;
        return {
          tipo: "contact.lead_hot",
          recipientUserId: null,
          values: { nome: nome ?? "Um lead" },
          link: payload.contactId ? `/painel/crm/contatos/${payload.contactId}` : null,
        };
      },
      "conversation.analysis_completed": (payload) => {
        const notaGeral = payload.data["notaGeral"] as number | undefined;
        return {
          tipo: "conversation.analysis_completed",
          recipientUserId: null,
          values: { nota: notaGeral !== undefined ? String(notaGeral) : "indisponível" },
          link: payload.conversationId ? `/painel/atendimento/inbox?conversationId=${payload.conversationId}` : null,
        };
      },
    };

    for (const [eventName, handler] of Object.entries(handlers) as [DomainEventName, (payload: DomainEventPayload) => HandlerResult][]) {
      this.emitter.on(eventName, (payload: DomainEventPayload) => {
        this.handle(payload, handler).catch((error: unknown) => {
          this.logger.error(`Falha ao gerar notificação para "${eventName}": ${String(error)}`);
        });
      });
    }
  }

  private async handle(payload: DomainEventPayload, handler: (payload: DomainEventPayload) => HandlerResult): Promise<void> {
    const { tipo, recipientUserId, values, link } = handler(payload);
    const { titulo, corpo, critical, ativo } = await this.templates.render(payload.tenantId, tipo, values);
    if (!ativo) return;
    await this.notifications.create({
      tenantId: payload.tenantId,
      recipientUserId: recipientUserId ?? null,
      tipo,
      titulo,
      corpo,
      link,
      critical,
    });
  }
}
