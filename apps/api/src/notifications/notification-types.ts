/**
 * Catálogo dos tipos de notificação que o sistema gera (ver `NotificationsListener`) — fonte única
 * dos textos padrão (título/corpo), com placeholders `{{chave}}` substituídos pelo dado real do
 * evento na hora de montar a notificação. Um tenant pode sobrescrever título/corpo de qualquer tipo
 * (ver `NotificationTemplatesService`/model `NotificationTemplate`) — sem override, usa o texto
 * padrão daqui. `critical` marca os tipos elegíveis para also disparar WhatsApp administrativo (ver
 * `NotificationsService.sendWhatsappAdmin`) — os demais ficam só na notificação in-app.
 */
export interface NotificationPlaceholder {
  key: string;
  label: string;
}

export interface NotificationTypeDefinition {
  tipo: string;
  defaultTitulo: string;
  defaultCorpo: string;
  placeholders: NotificationPlaceholder[];
  critical: boolean;
}

export const NOTIFICATION_TYPES: NotificationTypeDefinition[] = [
  {
    tipo: "conversation.created",
    defaultTitulo: "Nova conversa",
    defaultCorpo: "Uma nova conversa chegou na central de atendimento.",
    placeholders: [],
    critical: false,
  },
  {
    tipo: "conversation.transferred",
    defaultTitulo: "Nova transferência",
    defaultCorpo: "Uma conversa foi transferida para {{destino}}.",
    placeholders: [{ key: "destino", label: "Destino da transferência (você / uma fila)" }],
    critical: false,
  },
  {
    tipo: "whatsapp_number.disconnected",
    defaultTitulo: "Número desconectado",
    defaultCorpo: "O número {{numero}} foi desconectado.",
    placeholders: [{ key: "numero", label: "Número desconectado" }],
    critical: true,
  },
  {
    tipo: "crm_task.overdue",
    defaultTitulo: "Retorno atrasado",
    defaultCorpo: 'O retorno "{{titulo}}" está atrasado.',
    placeholders: [{ key: "titulo", label: "Título da tarefa" }],
    critical: true,
  },
  {
    tipo: "contact.lead_hot",
    defaultTitulo: "Lead quente",
    defaultCorpo: "{{nome}} atingiu pontuação de lead quente.",
    placeholders: [{ key: "nome", label: "Nome do contato" }],
    critical: true,
  },
  {
    tipo: "conversation.analysis_completed",
    defaultTitulo: "Análise concluída",
    defaultCorpo: "A análise de atendimento com IA foi concluída (nota {{nota}}).",
    placeholders: [{ key: "nota", label: "Nota da análise" }],
    critical: false,
  },
];

/** Só os tipos que disparam WhatsApp administrativo — usado no cadastro de destinatários. */
export const CRITICAL_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter((t) => t.critical);

export function findNotificationType(tipo: string): NotificationTypeDefinition | undefined {
  return NOTIFICATION_TYPES.find((t) => t.tipo === tipo);
}

/** Substitui `{{chave}}` pelo valor correspondente em `values` — chave ausente vira string vazia. */
export function renderNotificationText(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "");
}
