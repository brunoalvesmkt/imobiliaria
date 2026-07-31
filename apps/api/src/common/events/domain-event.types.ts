/**
 * Catálogo de eventos de domínio emitidos pelos módulos já implementados —
 * a base sobre a qual a Automação (Fase 7) constrói seus gatilhos (ver
 * prompt mestre §12.2). Cresce junto com novos módulos; nem todo evento do
 * prompt mestre está coberto ainda (ex.: "aniversário" exigiria um job
 * agendado diário, fora do escopo desta fase).
 */
export type DomainEventName =
  | "conversation.created"
  | "message.received"
  | "opportunity.stage_changed"
  | "opportunity.won"
  | "opportunity.lost"
  | "crm_task.created"
  | "chatbot.flow.completed"
  | "chatbot.flow.abandoned"
  | "chatbot.flow.transferred"
  | "invoice.paid"
  | "invoice.overdue"
  | "subscription.activated"
  | "subscription.cancelled"
  | "contact.created"
  | "conversation.closed"
  | "conversation.transferred"
  | "whatsapp_number.connected"
  | "whatsapp_number.disconnected"
  | "crm_task.overdue"
  | "contact.lead_hot"
  | "conversation.analysis_completed";

export interface DomainEventPayload {
  tenantId: string;
  contactId?: string | undefined;
  conversationId?: string | undefined;
  opportunityId?: string | undefined;
  data: Record<string, unknown>;
}

export const ALL_DOMAIN_EVENTS: DomainEventName[] = [
  "conversation.created",
  "message.received",
  "opportunity.stage_changed",
  "opportunity.won",
  "opportunity.lost",
  "crm_task.created",
  "chatbot.flow.completed",
  "chatbot.flow.abandoned",
  "chatbot.flow.transferred",
  "invoice.paid",
  "invoice.overdue",
  "subscription.activated",
  "subscription.cancelled",
  "contact.created",
  "conversation.closed",
  "conversation.transferred",
  "whatsapp_number.connected",
  "whatsapp_number.disconnected",
  "crm_task.overdue",
  "contact.lead_hot",
  "conversation.analysis_completed",
];
