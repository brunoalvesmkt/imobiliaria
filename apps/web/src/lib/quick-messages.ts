import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface QuickMessage {
  id: string;
  titulo: string;
  texto: string;
  categoria: string | null;
  atalho: string | null;
  teamId: string | null;
  ativo: boolean;
}

export function useQuickMessages(teamId?: string, includeInactive?: boolean) {
  return useQuery({
    queryKey: ["atendimento", "quick-messages", teamId ?? "", includeInactive ?? false],
    queryFn: () => {
      const params = new URLSearchParams();
      if (teamId) params.set("teamId", teamId);
      if (includeInactive) params.set("includeInactive", "true");
      const query = params.toString();
      return apiGet<QuickMessage[]>(`/atendimento/quick-messages${query ? `?${query}` : ""}`);
    },
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
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      ativo?: boolean;
      titulo?: string;
      texto?: string;
      categoria?: string;
      atalho?: string;
    }) => apiPatch<QuickMessage>(`/atendimento/quick-messages/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "quick-messages"] }),
  });
}

export function useDeleteQuickMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/atendimento/quick-messages/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "quick-messages"] }),
  });
}

export function useRenderQuickMessage() {
  return useMutation({
    mutationFn: ({ id, conversationId }: { id: string; conversationId?: string }) =>
      apiPost<{ texto: string }>(`/atendimento/quick-messages/${id}/render`, { conversationId }),
  });
}
