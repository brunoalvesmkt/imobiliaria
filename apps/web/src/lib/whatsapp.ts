import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface WhatsAppNumber {
  id: string;
  nome: string | null;
  tipo: "chatbot" | "atendente";
  modalidade: "official_api" | "unofficial";
  numero: string;
  status: "connected" | "disconnected" | "paused" | "authenticating" | "unavailable" | "error" | "blocked";
  provider: string;
  externalAccountId: string | null;
  riskAccepted: boolean;
  chatbotFlowId: string | null;
  createdAt: string;
}

export type FlowActivationRule = "keyword" | "any";

export interface NumberFlowLink {
  id: string;
  whatsAppNumberId: string;
  chatbotFlowId: string;
  ativo: boolean;
  regraAtivacao: FlowActivationRule;
  termos: string[];
  prioridade: number;
  /** Só tem efeito em regraAtivacao === "any" — quando true, vence toda mensagem nova sem checar palavra/frase específica. */
  prioritized: boolean;
  createdAt: string;
  updatedAt: string;
  chatbotFlow: { id: string; nome: string; status: string; versaoAtual: number; updatedAt: string };
}

export function useNumbers() {
  return useQuery({
    queryKey: ["whatsapp", "numbers"],
    queryFn: () => apiGet<WhatsAppNumber[]>("/whatsapp/numbers"),
  });
}

export function useCreateNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome?: string; tipo: "chatbot" | "atendente"; modalidade: "official_api" | "unofficial"; numero: string }) =>
      apiPost<WhatsAppNumber>("/whatsapp/numbers", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

export function useUpdateNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string }) =>
      apiPatch<WhatsAppNumber>(`/whatsapp/numbers/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

export function useNumberFlows(numberId: string) {
  return useQuery({
    queryKey: ["whatsapp", "numbers", numberId, "flows"],
    queryFn: () => apiGet<NumberFlowLink[]>(`/whatsapp/numbers/${numberId}/flows`),
    enabled: !!numberId,
  });
}

export function useLinkNumberFlow(numberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { chatbotFlowId: string; regraAtivacao: FlowActivationRule; termos?: string[]; prioridade?: number }) =>
      apiPost<NumberFlowLink>(`/whatsapp/numbers/${numberId}/flows`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers", numberId, "flows"] }),
  });
}

export function useUpdateNumberFlow(numberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      regraAtivacao?: FlowActivationRule;
      termos?: string[];
      prioridade?: number;
      ativo?: boolean;
      prioritized?: boolean;
    }) => apiPatch<NumberFlowLink>(`/whatsapp/numbers/${numberId}/flows/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers", numberId, "flows"] }),
  });
}

export function useActivateNumberFlowAsAny(numberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<NumberFlowLink>(`/whatsapp/numbers/${numberId}/flows/${id}/activate-any`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers", numberId, "flows"] }),
  });
}

export function useUnlinkNumberFlow(numberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/whatsapp/numbers/${numberId}/flows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers", numberId, "flows"] }),
  });
}

export function useDeleteNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/whatsapp/numbers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

export function useRiskTerm() {
  return useQuery({
    queryKey: ["whatsapp", "risk-term"],
    queryFn: () => apiGet<{ versao: string; texto: string }>("/whatsapp/numbers/risk-term"),
  });
}

export function useConnectNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<{ status: string; qrCode?: string }>(`/whatsapp/numbers/${id}/connect`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

/**
 * Enquanto o número está `authenticating`, o QR Code de provedores baseados
 * em socket (Baileys) muda sozinho a cada ~20s até ser escaneado — este hook
 * faz o polling do QR/status mais recente até a conexão fechar (conectada,
 * ou desistência do usuário saindo da tela).
 */
export function useNumberQr(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp", "numbers", id, "qr"],
    queryFn: () => apiGet<{ status: string; qrCode?: string }>(`/whatsapp/numbers/${id}/qr`),
    enabled,
    refetchInterval: (query) => (query.state.data?.status === "connected" ? false : 3000),
  });
}

export function useConfirmConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/whatsapp/numbers/${id}/confirm-connection`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

export function useAcceptRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/whatsapp/numbers/${id}/accept-risk`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

export function useSetChatbotFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, chatbotFlowId }: { id: string; chatbotFlowId: string | null }) =>
      apiPatch<WhatsAppNumber>(`/whatsapp/numbers/${id}/chatbot-flow`, { chatbotFlowId: chatbotFlowId ?? undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}

export function useDisconnectNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/whatsapp/numbers/${id}/disconnect`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "numbers"] }),
  });
}
