import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface Message {
  id: string;
  conversationId: string;
  direction: "in" | "out";
  senderType: "contact" | "agent" | "chatbot" | "system";
  tipo: "text" | "image" | "audio" | "video" | "document" | "location";
  conteudo: string | null;
  midiaUrl: string | null;
  statusEntrega: "sent" | "delivered" | "read" | "failed";
  createdAt: string;
}

export interface Conversation {
  id: string;
  contatoNumero: string;
  contactId: string | null;
  whatsAppNumberId: string;
  queueId: string | null;
  responsavelId: string | null;
  status: "open" | "pending" | "closed";
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  whatsAppNumber?: { id: string; numero: string };
  queue?: { id: string; nome: string } | null;
  responsavel?: { id: string; nome: string } | null;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export function useInbox(status?: string, queueId?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (queueId) params.set("queueId", queueId);
  const qs = params.toString();
  return useQuery({
    queryKey: ["atendimento", "inbox", status ?? "", queueId ?? ""],
    queryFn: () => apiGet<Conversation[]>(`/atendimento/inbox${qs ? `?${qs}` : ""}`),
    refetchInterval: 15_000,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["whatsapp", "conversations", id],
    queryFn: () => apiGet<ConversationDetail>(`/whatsapp/conversations/${id}`),
    enabled: !!id,
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (texto: string) => apiPost<Message>(`/whatsapp/conversations/${conversationId}/messages`, { tipo: "text", texto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "conversations", conversationId] }),
  });
}

function useInboxAction(path: (id: string) => string, method: "post" | "patch" = "post") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: unknown }) =>
      method === "post" ? apiPost(path(id), body) : apiPatch(path(id), body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["atendimento", "inbox"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "conversations", id] });
    },
  });
}

export function useAssignQueue() {
  return useInboxAction((id) => `/atendimento/inbox/${id}/queue`, "patch");
}
export function useAutoAssign() {
  return useInboxAction((id) => `/atendimento/inbox/${id}/auto-assign`);
}
export function useAssume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      apiPost(`/atendimento/inbox/${id}/assume${force ? "?force=true" : ""}`),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["atendimento", "inbox"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "conversations", id] });
    },
  });
}
export function useReturnToQueue() {
  return useInboxAction((id) => `/atendimento/inbox/${id}/return-to-queue`);
}
export function useTransfer() {
  return useInboxAction((id) => `/atendimento/inbox/${id}/transfer`);
}
export function useCloseConversation() {
  return useInboxAction((id) => `/atendimento/inbox/${id}/close`);
}
export function useReopenConversation() {
  return useInboxAction((id) => `/atendimento/inbox/${id}/reopen`);
}

export interface Team {
  id: string;
  nome: string;
  ativo: boolean;
  members: {
    id: string;
    tenantUserId: string;
    papel: string;
    prioridade: number;
    tenantUser: { id: string; nome: string; email: string };
  }[];
}

export function useTeams() {
  return useQuery({ queryKey: ["atendimento", "teams"], queryFn: () => apiGet<Team[]>("/atendimento/teams") });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nome: string) => apiPost<Team>("/atendimento/teams", { nome }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useAddTeamMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenantUserId: string; papel?: "agent" | "supervisor" }) =>
      apiPost(`/atendimento/teams/${teamId}/members`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useUpdateTeamMemberPriority(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { tenantUserId: string; prioridade: number }) =>
      apiPatch(`/atendimento/teams/${teamId}/members/${input.tenantUserId}`, { prioridade: input.prioridade }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useRemoveTeamMember(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantUserId: string) => apiDelete(`/atendimento/teams/${teamId}/members/${tenantUserId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useUpdateTeam(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ nome: string }>) => apiPatch<Team>(`/atendimento/teams/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useDeactivateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Team>(`/atendimento/teams/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useReactivateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Team>(`/atendimento/teams/${id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/atendimento/teams/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "teams"] }),
  });
}

export interface Queue {
  id: string;
  nome: string;
  descricao: string | null;
  teamId: string | null;
  prioridade: number;
  distribuicao: "round_robin" | "least_volume" | "priority";
  slaMinutos: number | null;
  mensagemEspera: string | null;
  mensagemForaExpediente: string | null;
  ativo: boolean;
}

export function useQueues() {
  return useQuery({ queryKey: ["atendimento", "queues"], queryFn: () => apiGet<Queue[]>("/atendimento/queues") });
}

export function useCreateQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; teamId?: string }) => apiPost<Queue>("/atendimento/queues", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "queues"] }),
  });
}

export function useUpdateQueue(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ nome: string; descricao: string; teamId: string | null; prioridade: number; distribuicao: Queue["distribuicao"]; slaMinutos: number; mensagemEspera: string; mensagemForaExpediente: string }>) =>
      apiPatch<Queue>(`/atendimento/queues/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "queues"] }),
  });
}

export function useDeactivateQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Queue>(`/atendimento/queues/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "queues"] }),
  });
}

export function useReactivateQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<Queue>(`/atendimento/queues/${id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "queues"] }),
  });
}

export function useDeleteQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/atendimento/queues/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "queues"] }),
  });
}

export interface BusinessHours {
  id: string;
  queueId: string;
  diaSemana: number | null;
  horaInicio: string | null;
  horaFim: string | null;
  feriadoData: string | null;
  escopo: string | null;
}

export function useBusinessHours(queueId: string) {
  return useQuery({
    queryKey: ["atendimento", "queues", queueId, "business-hours"],
    queryFn: () => apiGet<BusinessHours[]>(`/atendimento/queues/${queueId}/business-hours`),
    enabled: !!queueId,
  });
}

export function useAddBusinessHours(queueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { diaSemana?: number; horaInicio?: string; horaFim?: string }) =>
      apiPost<BusinessHours>(`/atendimento/queues/${queueId}/business-hours`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["atendimento", "queues", queueId, "business-hours"] }),
  });
}
