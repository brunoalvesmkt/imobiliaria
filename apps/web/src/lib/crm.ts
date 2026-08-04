import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, omitEmptyStrings } from "./api-client";

export type ContactPhoneType = "whatsapp" | "residencial" | "comercial";

export interface ContactPhone {
  id: string;
  numero: string;
  tipo: ContactPhoneType;
  principal: boolean;
}

export interface ContactEmail {
  id: string;
  email: string;
  principal: boolean;
}

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
  origemId: string | null;
  origemRef: { id: string; nome: string } | null;
  phones: ContactPhone[];
  emails: ContactEmail[];
  observacoes: string | null;
  tags: string[];
  customFields: Record<string, unknown> | null;
  leadScore: number;
  createdAt: string;
  anonymizedAt: string | null;
  bloqueado: boolean;
  bloqueadoEm: string | null;
  bloqueadoMotivo: string | null;
  ativo: boolean;
}

export interface ContactOrigin {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export function useContactOrigins() {
  return useQuery({ queryKey: ["crm", "contact-origins"], queryFn: () => apiGet<ContactOrigin[]>("/crm/contact-origins") });
}

export function useCreateContactOrigin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiPost<ContactOrigin>("/crm/contact-origins", { nome }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "contact-origins"] }),
  });
}

export function useUpdateContactOrigin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string; ativo?: boolean; ordem?: number }) =>
      apiPatch<ContactOrigin>(`/crm/contact-origins/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "contact-origins"] }),
  });
}

export function useDeleteContactOrigin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, substitutaId }: { id: string; substitutaId?: string | undefined }) =>
      apiDelete<{ status: "ok" }>(`/crm/contact-origins/${id}${substitutaId ? `?substitutaId=${substitutaId}` : ""}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "contact-origins"] }),
  });
}

export interface CrmTaskType {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export function useTaskTypes() {
  return useQuery({ queryKey: ["crm", "task-types"], queryFn: () => apiGet<CrmTaskType[]>("/crm/task-types") });
}

export function useCreateTaskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiPost<CrmTaskType>("/crm/task-types", { nome }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "task-types"] }),
  });
}

export function useUpdateTaskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string; ativo?: boolean; ordem?: number }) =>
      apiPatch<CrmTaskType>(`/crm/task-types/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "task-types"] }),
  });
}

export function useDeleteTaskType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/crm/task-types/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "task-types"] }),
  });
}

export function useImportContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { format: "csv" | "xlsx"; content: string }) =>
      apiPost<{ imported: number; skipped: number; errors: { linha: number; mensagem: string }[] }>("/crm/contacts/import", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] }),
  });
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
  origemId?: string;
  phones?: { numero: string; tipo: ContactPhoneType; principal?: boolean }[];
  emails?: { email: string; principal?: boolean }[];
  observacoes?: string;
}

export function useContacts(search: string, origemId?: string, phoneType?: ContactPhoneType) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (origemId) params.set("origemId", origemId);
  if (phoneType) params.set("phoneType", phoneType);
  const qs = params.toString();
  return useQuery({
    queryKey: ["crm", "contacts", search, origemId ?? "", phoneType ?? ""],
    queryFn: () => apiGet<Contact[]>(`/crm/contacts${qs ? `?${qs}` : ""}`),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: ["crm", "contacts", id],
    queryFn: () => apiGet<Contact>(`/crm/contacts/${id}`),
    enabled: !!id,
  });
}

export interface OpportunityStageTimelineEntry {
  stageId: string;
  stageName: string;
  enteredAt: string;
  exitedAt: string | null;
  durationHours: number | null;
}

export interface OpportunityTimeline {
  id: string;
  funnelName: string;
  currentStageName: string;
  status: "open" | "won" | "lost";
  valor: number | null;
  createdAt: string;
  wonAt: string | null;
  lostAt: string | null;
  totalTimeHours: number;
  timeToWonHours: number | null;
  timeToLostHours: number | null;
  stages: OpportunityStageTimelineEntry[];
}

export function useContactOpportunitiesTimeline(contactId: string) {
  return useQuery({
    queryKey: ["crm", "contacts", contactId, "opportunities-timeline"],
    queryFn: () => apiGet<OpportunityTimeline[]>(`/crm/contacts/${contactId}/opportunities-timeline`),
    enabled: !!contactId,
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

export function useDeactivateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Contact>(`/crm/contacts/${id}/deactivate`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      queryClient.setQueryData(["crm", "contacts", id], updated);
    },
  });
}

export function useReactivateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Contact>(`/crm/contacts/${id}/reactivate`),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] });
      queryClient.setQueryData(["crm", "contacts", id], updated);
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/crm/contacts/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "contacts"] }),
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

export function useUpdateFunnel(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome?: string; descricao?: string; status?: string }) => apiPatch<Funnel>(`/crm/funnels/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] }),
  });
}

export function useUpdateStage(funnelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      stageId,
      ...input
    }: {
      stageId: string;
      nome?: string;
      ordem?: number;
      cor?: string;
      probabilidade?: number;
      slaHoras?: number;
    }) => apiPatch<FunnelStage>(`/crm/funnels/${funnelId}/stages/${stageId}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] }),
  });
}

export function useDeleteFunnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/crm/funnels/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] }),
  });
}

export function useRemoveStage(funnelId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, targetStageId }: { stageId: string; targetStageId?: string | undefined }) =>
      apiDelete<{ status: "ok" }>(
        `/crm/funnels/${funnelId}/stages/${stageId}${targetStageId ? `?targetStageId=${targetStageId}` : ""}`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] }),
  });
}

export function useTransferOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ opportunityId, targetFunnelId }: { opportunityId: string; targetFunnelId: string }) =>
      apiPost<Opportunity>(`/crm/funnels/opportunities/${opportunityId}/transfer`, { targetFunnelId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["crm", "funnels"] });
    },
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
  stageEnteredAt: string;
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

export type CrmTaskView = "hoje" | "atrasadas" | "futuras" | "todas" | "periodo";

export function useTasks(
  contactId?: string,
  status?: string,
  view?: CrmTaskView,
  range?: { dataInicio?: string; dataFim?: string },
  tipo?: string,
) {
  const params = new URLSearchParams();
  if (contactId) params.set("contactId", contactId);
  if (status) params.set("status", status);
  if (view) params.set("view", view);
  if (range?.dataInicio) params.set("dataInicio", range.dataInicio);
  if (range?.dataFim) params.set("dataFim", range.dataFim);
  if (tipo) params.set("tipo", tipo);
  const qs = params.toString();
  return useQuery({
    queryKey: ["crm", "tasks", contactId ?? "", status ?? "", view ?? "", range?.dataInicio ?? "", range?.dataFim ?? "", tipo ?? ""],
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
