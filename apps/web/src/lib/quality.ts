import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export interface EvaluationCriterion {
  nome: string;
  nota: number;
  comentario: string;
}

export interface ConversationEvaluation {
  id: string;
  conversationId: string;
  solicitanteId: string;
  notaGeral: number;
  classificacao: string;
  criteriosAvaliados: EvaluationCriterion[];
  pontosPositivos: string[];
  pontosMelhoria: string[];
  oportunidadesPerdidas: string[];
  momentosCriticos: string[];
  sugestoes: string[];
  resumoExecutivo: string;
  modeloUtilizado: string;
  createdAt: string;
}

export function useConversationEvaluations(conversationId: string) {
  return useQuery({
    queryKey: ["atendimento", "quality", conversationId],
    queryFn: () => apiGet<ConversationEvaluation[]>(`/atendimento/inbox/${conversationId}/analysis`),
    enabled: !!conversationId,
  });
}

export function useAnalyzeConversation(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<ConversationEvaluation>(`/atendimento/inbox/${conversationId}/analysis`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "quality", conversationId] }),
  });
}

export interface QualityCriterionConfig {
  nome: string;
  peso: number;
  obrigatorio: boolean;
}

export interface QualityConfig {
  criterios: QualityCriterionConfig[];
  notaMinima: number;
}

export function useQualityConfig() {
  return useQuery({
    queryKey: ["atendimento", "quality-config"],
    queryFn: () => apiGet<QualityConfig>("/atendimento/quality-config"),
  });
}

export function useUpdateQualityConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QualityConfig) => apiPatch<QualityConfig>("/atendimento/quality-config", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "quality-config"] }),
  });
}
