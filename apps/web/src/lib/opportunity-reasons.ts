import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface OpportunityReason {
  id: string;
  tenantId: string;
  tipo: "won" | "lost";
  nome: string;
  ativo: boolean;
  ordem: number;
  obrigatorioObservacao: boolean;
}

export function useOpportunityReasons(tipo?: "won" | "lost") {
  return useQuery({
    queryKey: ["crm", "opportunity-reasons", tipo ?? "all"],
    queryFn: () => apiGet<OpportunityReason[]>(`/crm/opportunity-reasons${tipo ? `?tipo=${tipo}` : ""}`),
  });
}

export function useCreateOpportunityReason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tipo: "won" | "lost"; nome: string; ordem?: number; obrigatorioObservacao?: boolean }) =>
      apiPost<OpportunityReason>("/crm/opportunity-reasons", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunity-reasons"] }),
  });
}

export function useUpdateOpportunityReason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string; ativo?: boolean; ordem?: number; obrigatorioObservacao?: boolean }) =>
      apiPatch<OpportunityReason>(`/crm/opportunity-reasons/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunity-reasons"] }),
  });
}

export function useDeleteOpportunityReason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/crm/opportunity-reasons/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "opportunity-reasons"] }),
  });
}
