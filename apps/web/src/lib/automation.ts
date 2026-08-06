import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export type DomainEventName =
  | "conversation.created"
  | "conversation.closed"
  | "conversation.transferred"
  | "conversation.analysis_completed"
  | "message.received"
  | "whatsapp_number.connected"
  | "whatsapp_number.disconnected"
  | "contact.created"
  | "contact.lead_hot"
  | "opportunity.stage_changed"
  | "opportunity.won"
  | "opportunity.lost"
  | "crm_task.created"
  | "crm_task.overdue"
  | "chatbot.flow.completed"
  | "chatbot.flow.abandoned"
  | "chatbot.flow.transferred"
  | "invoice.paid"
  | "invoice.overdue"
  | "subscription.activated"
  | "subscription.cancelled";

export const DEFAULT_DOMAIN_EVENT: DomainEventName = "conversation.created";

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

export const AUTOMATION_CATEGORIES = ["atendimento", "crm", "tarefas", "posvenda", "data"] as const;
export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number];

export interface Automation {
  id: string;
  nome: string;
  descricao: string | null;
  tipoAutomacao: AutomationCategory | null;
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

export interface AutomationCatalogTrigger {
  event: DomainEventName;
  category: AutomationCategory | null;
  requiredModule: string | null;
  fields: string[];
  available: boolean;
}

export interface AutomationCatalogAction {
  tipo: ActionType;
  requiredModule: string | null;
  available: boolean;
}

export interface AutomationCatalog {
  categories: AutomationCategory[];
  triggers: AutomationCatalogTrigger[];
  actions: AutomationCatalogAction[];
}

/** Catálogo de gatilhos/ações disponíveis para o tenant, já filtrado pelos módulos ativos — fonte única servida pelo backend (ver automation-definition.types.ts), evita duplicar/desatualizar essa lista aqui. */
export function useAutomationCatalog() {
  return useQuery({
    queryKey: ["automation", "rules", "catalog"],
    queryFn: () => apiGet<AutomationCatalog>("/automation/rules/catalog"),
    staleTime: 60_000,
  });
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

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/automation/rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation", "rules"] }),
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      nome: string;
      descricao?: string;
      tipoAutomacao?: AutomationCategory;
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
      tipoAutomacao: AutomationCategory;
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
