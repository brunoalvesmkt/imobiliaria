import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, omitEmptyStrings } from "./api-client";

export interface Contact {
  id: string;
  nome: string;
  sobrenome: string | null;
  cpf: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  origem: string | null;
  observacoes: string | null;
  tags: string[];
  customFields: Record<string, unknown> | null;
  leadScore: number;
  createdAt: string;
  anonymizedAt: string | null;
  bloqueado: boolean;
  bloqueadoEm: string | null;
  bloqueadoMotivo: string | null;
}

export interface LeadScoreThresholds {
  morno: number;
  quente: number;
}

/** Faixas padrão do prompt mestre §4 — 0-39 Frio, 40-69 Morno, 70-100 Quente; editáveis por tenant (Fase 42). */
export const DEFAULT_LEAD_SCORE_THRESHOLDS: LeadScoreThresholds = { morno: 40, quente: 70 };

export function classifyLeadScore(score: number, thresholds: LeadScoreThresholds = DEFAULT_LEAD_SCORE_THRESHOLDS): "frio" | "morno" | "quente" {
  if (score >= thresholds.quente) return "quente";
  if (score >= thresholds.morno) return "morno";
  return "frio";
}

export function useLeadScoreConfig() {
  return useQuery({
    queryKey: ["crm", "lead-score-config"],
    queryFn: () => apiGet<LeadScoreThresholds>("/crm/lead-score-config"),
  });
}

export function useUpdateLeadScoreConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LeadScoreThresholds) => apiPatch<LeadScoreThresholds>("/crm/lead-score-config", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "lead-score-config"] }),
  });
}

export interface CreateContactInput {
  nome: string;
  sobrenome?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  origem?: string;
  observacoes?: string;
}

export function useContacts(search: string) {
  return useQuery({
    queryKey: ["crm", "contacts", search],
    queryFn: () => apiGet<Contact[]>(`/crm/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ["crm", "contacts", id],
    queryFn: () => apiGet<Contact>(`/crm/contacts/${id}`),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContactInput) => apiPost<Contact>("/crm/contacts", omitEmptyStrings(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] }),
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateContactInput>) => apiPatch<Contact>(`/crm/contacts/${id}`, omitEmptyStrings(input)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
    },
  });
}

export function useAnonymizeContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Contact>(`/crm/contacts/${id}/lgpd/anonymize`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      queryClient.setQueryData(["crm", "contacts", id], updated);
    },
  });
}

export function useBlockContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (motivo?: string) => apiPost<Contact>(`/crm/contacts/${id}/block`, { motivo }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      queryClient.setQueryData(["crm", "contacts", id], updated);
    },
  });
}

export function useUnblockContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Contact>(`/crm/contacts/${id}/unblock`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      queryClient.setQueryData(["crm", "contacts", id], updated);
    },
  });
}

export function useMergeContacts(primaryId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (duplicateId: string) => apiPost<Contact>(`/crm/contacts/${primaryId}/merge`, { duplicateId }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      queryClient.setQueryData(["crm", "contacts", primaryId], updated);
    },
  });
}

export const CUSTOM_FIELD_TYPES = ["texto", "numero", "data", "moeda", "lista", "multipla_escolha", "booleano", "texto_longo"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export interface CustomFieldDefinition {
  id: string;
  nome: string;
  chave: string;
  tipo: CustomFieldType;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
}

export function useCustomFieldDefinitions() {
  return useQuery({
    queryKey: ["crm", "custom-fields"],
    queryFn: () => apiGet<CustomFieldDefinition[]>("/crm/custom-fields"),
  });
}

export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; chave: string; tipo: CustomFieldType; opcoes?: string[]; obrigatorio?: boolean }) =>
      apiPost<CustomFieldDefinition>("/crm/custom-fields", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "custom-fields"] }),
  });
}

export function useUpdateCustomFieldDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; ativo?: boolean; nome?: string; obrigatorio?: boolean }) =>
      apiPatch<CustomFieldDefinition>(`/crm/custom-fields/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "custom-fields"] }),
  });
}

export interface FunnelStage {
  id: string;
  funnelId: string;
  nome: string;
  ordem: number;
  probabilidade: number | null;
  cor: string | null;
}

export interface Funnel {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  ordem: number;
  stages: FunnelStage[];
}

export function useFunnels() {
  return useQuery({
    queryKey: ["crm", "funnels"],
    queryFn: () => apiGet<Funnel[]>("/crm/funnels"),
  });
}

export function useCreateFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string }) => apiPost<Funnel>("/crm/funnels", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] }),
  });
}

export function useAddStage(funnelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; ordem: number; probabilidade?: number }) =>
      apiPost<FunnelStage>(`/crm/funnels/${funnelId}/stages`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] }),
  });
}

export interface Opportunity {
  id: string;
  contactId: string;
  funnelId: string;
  stageId: string;
  valor: string | null;
  status: "open" | "won" | "lost";
  probabilidade: number | null;
  createdAt: string;
  contact: { id: string; nome: string; whatsapp: string | null };
}

export function useOpportunities(funnelId: string) {
  return useQuery({
    queryKey: ["crm", "opportunities", funnelId],
    queryFn: () => apiGet<Opportunity[]>(`/crm/opportunities?funnelId=${funnelId}`),
    enabled: !!funnelId,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { contactId: string; funnelId: string; stageId: string; valor?: number }) =>
      apiPost<Opportunity>("/crm/opportunities", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
  });
}

export function useMoveOpportunityStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      apiPatch<Opportunity>(`/crm/opportunities/${id}/stage`, { stageId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
  });
}

export function useReorderOpportunities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, orderedIds }: { stageId: string; orderedIds: string[] }) =>
      apiPost<{ status: string }>("/crm/opportunities/reorder", { stageId, orderedIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
  });
}

export function useCloseOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resultado, motivo }: { id: string; resultado: "won" | "lost"; motivo?: string }) =>
      apiPatch<Opportunity>(`/crm/opportunities/${id}/close`, { resultado, motivo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
  });
}

export interface CrmTask {
  id: string;
  contactId: string;
  opportunityId: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  dataHora: string;
  status: "pending" | "done" | "overdue";
  concluidaEm: string | null;
}

export function useTasks(contactId?: string, status?: string) {
  const params = new URLSearchParams();
  if (contactId) params.set("contactId", contactId);
  if (status) params.set("status", status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["crm", "tasks", contactId ?? "", status ?? ""],
    queryFn: () => apiGet<CrmTask[]>(`/crm/tasks${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { contactId: string; tipo: string; titulo: string; dataHora: string; opportunityId?: string }) =>
      apiPost<CrmTask>("/crm/tasks", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; titulo?: string }) => apiPatch<CrmTask>(`/crm/tasks/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "tasks"] }),
  });
}
