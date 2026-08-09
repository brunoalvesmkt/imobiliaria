import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface StageChecklistItem {
  id: string;
  tenantId: string;
  stageId: string;
  titulo: string;
  ordem: number;
  ativo: boolean;
  obrigatorioMotivo: boolean;
}

export function useStageChecklistItems(stageId: string) {
  return useQuery({
    queryKey: ["crm", "stage-checklists", "items", stageId],
    queryFn: () => apiGet<StageChecklistItem[]>(`/crm/stage-checklists?stageId=${stageId}`),
    enabled: !!stageId,
  });
}

export function useCreateStageChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { stageId: string; titulo: string; ordem?: number; obrigatorioMotivo?: boolean }) =>
      apiPost<StageChecklistItem>("/crm/stage-checklists", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "stage-checklists", "items"] }),
  });
}

export function useUpdateStageChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; titulo?: string; ordem?: number; ativo?: boolean; obrigatorioMotivo?: boolean }) =>
      apiPatch<StageChecklistItem>(`/crm/stage-checklists/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "stage-checklists", "items"] }),
  });
}

export function useDeleteStageChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/crm/stage-checklists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "stage-checklists", "items"] }),
  });
}

export interface ChecklistFillEntry {
  id: string;
  opportunityId: string;
  stageId: string;
  preenchidoPor: string | null;
  itens: { itemId: string; titulo: string; resultado: "concluido" | "nao_concluido"; motivo: string | null }[];
  createdAt: string;
}

export function useChecklistHistory(opportunityId: string) {
  return useQuery({
    queryKey: ["crm", "stage-checklists", "history", opportunityId],
    queryFn: () => apiGet<ChecklistFillEntry[]>(`/crm/stage-checklists/opportunity/${opportunityId}/history`),
    enabled: !!opportunityId,
  });
}

export interface ChecklistProgressEntry {
  item: StageChecklistItem;
  resultado: "concluido" | "nao_concluido" | null;
  motivo: string | null;
}

export function useChecklistProgress(opportunityId: string) {
  return useQuery({
    queryKey: ["crm", "stage-checklists", "progress", opportunityId],
    queryFn: () => apiGet<ChecklistProgressEntry[]>(`/crm/stage-checklists/opportunity/${opportunityId}/progress`),
    enabled: !!opportunityId,
  });
}

export function useUpdateChecklistProgress(opportunityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: string; resultado: "concluido" | "nao_concluido"; motivo?: string }) =>
      apiPatch<ChecklistProgressEntry>(`/crm/stage-checklists/opportunity/${opportunityId}/progress`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "stage-checklists", "progress", opportunityId] }),
  });
}
