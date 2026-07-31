import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export interface QuickMessage {
  id: string;
  titulo: string;
  texto: string;
  categoria: string | null;
  atalho: string | null;
  teamId: string | null;
  ativo: boolean;
}

export function useQuickMessages(teamId?: string) {
  return useQuery({
    queryKey: ["atendimento", "quick-messages", teamId ?? ""],
    queryFn: () => apiGet<QuickMessage[]>(`/atendimento/quick-messages${teamId ? `?teamId=${teamId}` : ""}`),
  });
}

export function useCreateQuickMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { titulo: string; texto: string; categoria?: string; atalho?: string; teamId?: string }) =>
      apiPost<QuickMessage>("/atendimento/quick-messages", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "quick-messages"] }),
  });
}

export function useUpdateQuickMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; ativo?: boolean; titulo?: string; texto?: string }) =>
      apiPatch<QuickMessage>(`/atendimento/quick-messages/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "quick-messages"] }),
  });
}

export function useRenderQuickMessage() {
  return useMutation({
    mutationFn: ({ id, conversationId }: { id: string; conversationId?: string }) =>
      apiPost<{ texto: string }>(`/atendimento/quick-messages/${id}/render`, { conversationId }),
  });
}
