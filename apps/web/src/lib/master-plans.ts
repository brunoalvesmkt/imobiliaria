import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface MasterPlan {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  recorrencia: "mensal" | "anual";
  modulos: string[];
  limites: Record<string, number>;
  iaIncluida: boolean;
  apiOficial: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export const AVAILABLE_MODULES = ["crm", "whatsapp", "atendimento", "chatbot", "automacao"];

export function useMasterPlans() {
  return useQuery({ queryKey: ["master-plans"], queryFn: () => apiGet<MasterPlan[]>("/master/plans") });
}

export function useCreateMasterPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      nome: string;
      descricao?: string;
      preco: number;
      recorrencia: "mensal" | "anual";
      modulos: string[];
      limites: Record<string, number>;
      iaIncluida?: boolean;
      apiOficial?: boolean;
    }) => apiPost<MasterPlan>("/master/plans", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-plans"] }),
  });
}

export function useUpdateMasterPlan(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{
      nome: string;
      descricao: string;
      preco: number;
      recorrencia: "mensal" | "anual";
      modulos: string[];
      limites: Record<string, number>;
      iaIncluida: boolean;
      apiOficial: boolean;
      ativo: boolean;
    }>) => apiPatch<MasterPlan>(`/master/plans/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-plans"] }),
  });
}

export function useDeleteMasterPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/master/plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-plans"] }),
  });
}
