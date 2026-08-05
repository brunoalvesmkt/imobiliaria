import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

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
  | "subscription.cancelled";

export const DEFAULT_DOMAIN_EVENT: DomainEventName = "conversation.created";

export const DOMAIN_EVENTS: DomainEventName[] = [
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
];

/**
 * Campos disponíveis em `data` para cada gatilho (ver domainEvents.emit correspondente no
 * backend) — a Automação só sabe filtrar por esses nomes técnicos exatos, nunca por frases
 * livres. Usado para popular o seletor de "Campo" da condição, escopado ao gatilho escolhido, em
 * vez de deixar o usuário adivinhar/digitar um nome que não existe (e a condição nunca bater).
 */
export const TRIGGER_FIELDS: Record<DomainEventName, string[]> = {
  "conversation.created": ["conversationId", "origem", "contatoNumero"],
  "message.received": ["conversationId", "conteudo", "direction"],
  "opportunity.stage_changed": ["opportunityId", "stageId", "stageIdAnterior"],
  "opportunity.won": ["opportunityId", "motivo", "valor"],
  "opportunity.lost": ["opportunityId", "motivo", "valor"],
  "crm_task.created": ["taskId", "tipo", "titulo"],
  "chatbot.flow.completed": ["chatbotExecutionId", "chatbotFlowId"],
  "chatbot.flow.abandoned": ["chatbotExecutionId", "chatbotFlowId"],
  "chatbot.flow.transferred": ["chatbotExecutionId", "chatbotFlowId"],
  "invoice.paid": ["invoiceId", "subscriptionId", "planId", "valor"],
  "invoice.overdue": ["invoiceId", "subscriptionId"],
  "subscription.activated": ["subscriptionId", "planId"],
  "subscription.cancelled": ["subscriptionId", "motivo"],
};

/** Campos cujo valor é o ID de uma entidade com nome — a condição mostra um seletor por nome em vez de um campo de texto para o "Valor" (ver ConditionsEditor). */
export const ID_FIELD_KIND: Record<string, "stage" | "flow"> = {
  stageId: "stage",
  stageIdAnterior: "stage",
  chatbotFlowId: "flow",
};

export type ConditionOperator = "equals" | "contains" | "exists" | "not_exists";

export interface AutomationCondition {
  campo: string;
  operador: ConditionOperator;
  valor?: string;
}

export type ActionType =
  | "send_message"
  | "create_task"
  | "apply_tag"
  | "remove_tag"
  | "update_field"
  | "move_opportunity_stage"
  | "start_chatbot"
  | "send_webhook"
  | "schedule_followup";

export const ACTION_TYPES: ActionType[] = [
  "send_message",
  "create_task",
  "apply_tag",
  "remove_tag",
  "update_field",
  "move_opportunity_stage",
  "start_chatbot",
  "send_webhook",
  "schedule_followup",
];

export interface AutomationAction {
  tipo: ActionType;
  texto?: string;
  titulo?: string;
  tipoTarefa?: string;
  horasParaVencer?: number;
  tag?: string;
  campo?: string;
  valor?: string;
  stageId?: string;
  flowId?: string;
  url?: string;
  delayMinutes?: number;
  sequenciaIndex?: number;
}

export type AutomationStatus = "active" | "paused" | "archived";

export interface Automation {
  id: string;
  nome: string;
  descricao: string | null;
  gatilhoTipo: DomainEventName;
  condicoes: AutomationCondition[] | null;
  acoes: AutomationAction[];
  status: AutomationStatus;
  versao: number;
  createdAt: string;
  updatedAt: string;
}

export type ExecutionStatus = "pending" | "running" | "success" | "failed" | "dead_letter";

export interface AutomationExecution {
  id: string;
  automationId: string;
  contactId: string | null;
  conversationId: string | null;
  gatilhoDisparado: string;
  acoesExecutadas: unknown;
  tentativas: number;
  status: ExecutionStatus;
  erro: string | null;
  executedAt: string | null;
  createdAt: string;
}

export function useAutomations() {
  return useQuery({ queryKey: ["automation", "rules"], queryFn: () => apiGet<Automation[]>("/automation/rules") });
}

export function useAutomation(id: string) {
  return useQuery({
    queryKey: ["automation", "rules", id],
    queryFn: () => apiGet<Automation>(`/automation/rules/${id}`),
    enabled: !!id,
  });
}

export function useAutomationExecutions(id: string) {
  return useQuery({
    queryKey: ["automation", "rules", id, "executions"],
    queryFn: () => apiGet<AutomationExecution[]>(`/automation/rules/${id}/executions`),
    enabled: !!id,
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      nome: string;
      descricao?: string;
      gatilhoTipo: DomainEventName;
      condicoes?: AutomationCondition[];
      acoes: AutomationAction[];
    }) => apiPost<Automation>("/automation/rules", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation", "rules"] }),
  });
}

export function useUpdateAutomation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{
      nome: string;
      descricao: string;
      gatilhoTipo: DomainEventName;
      condicoes: AutomationCondition[];
      acoes: AutomationAction[];
      status: AutomationStatus;
    }>) => apiPatch<Automation>(`/automation/rules/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation", "rules"] });
      queryClient.invalidateQueries({ queryKey: ["automation", "rules", id] });
    },
  });
}
