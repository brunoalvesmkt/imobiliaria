import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";
import { useRealtimeEvent } from "./realtime";

export interface Notification {
  id: string;
  recipientUserId: string | null;
  tipo: string;
  titulo: string;
  corpo: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications(unreadOnly = false) {
  const queryClient = useQueryClient();

  useRealtimeEvent<Notification>("notification:new", () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  return useQuery({
    queryKey: ["notifications", "list", unreadOnly],
    queryFn: () => apiGet<Notification[]>(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),
    refetchInterval: 30_000,
  });
}

export function useUnreadNotificationCount() {
  const queryClient = useQueryClient();

  useRealtimeEvent<Notification>("notification:new", () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  });

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiGet<{ count: number }>("/notifications/unread-count"),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Notification>(`/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPatch<{ ok: true }>("/notifications/read-all", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export interface NotificationWhatsappSettings {
  whatsAppNumberId: string | null;
}

export function useNotificationWhatsappSettings() {
  return useQuery({
    queryKey: ["notifications", "settings", "whatsapp"],
    queryFn: () => apiGet<NotificationWhatsappSettings>("/notifications/settings/whatsapp"),
  });
}

export function useUpdateNotificationWhatsappSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationWhatsappSettings) => apiPatch<NotificationWhatsappSettings>("/notifications/settings/whatsapp", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "settings", "whatsapp"] }),
  });
}

/** Só os tipos elegíveis para o filtro de destinatário (os hoje críticos por padrão) — ver `NOTIFICATION_TYPES` no backend. */
export interface NotificationTypeOption {
  tipo: string;
  label: string;
}

export function useNotificationWhatsappTypes() {
  return useQuery({
    queryKey: ["notifications", "settings", "whatsapp", "types"],
    queryFn: () => apiGet<NotificationTypeOption[]>("/notifications/settings/whatsapp/types"),
    staleTime: 60_000,
  });
}

export interface NotificationRecipient {
  id: string;
  nome: string | null;
  numero: string;
  tipos: string[];
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useNotificationRecipients() {
  return useQuery({
    queryKey: ["notifications", "settings", "whatsapp", "recipients"],
    queryFn: () => apiGet<NotificationRecipient[]>("/notifications/settings/whatsapp/recipients"),
  });
}

export function useCreateNotificationRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome?: string; numero: string; tipos?: string[] }) =>
      apiPost<NotificationRecipient>("/notifications/settings/whatsapp/recipients", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "settings", "whatsapp", "recipients"] }),
  });
}

export function useUpdateNotificationRecipient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<{ nome: string; numero: string; tipos: string[]; ativo: boolean }>) =>
      apiPatch<NotificationRecipient>(`/notifications/settings/whatsapp/recipients/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "settings", "whatsapp", "recipients"] }),
  });
}

export function useNotificationRecipientLimit() {
  return useQuery({
    queryKey: ["notifications", "settings", "whatsapp", "recipients", "limit"],
    queryFn: () => apiGet<{ count: number; limit: number }>("/notifications/settings/whatsapp/recipients/limit"),
  });
}

export function useDeleteNotificationRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/notifications/settings/whatsapp/recipients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "settings", "whatsapp", "recipients"] }),
  });
}

export interface NotificationDelivery {
  id: string;
  tipo: string;
  mensagem: string;
  status: "sent" | "failed";
  erro: string | null;
  createdAt: string;
}

export function useNotificationDeliveries(recipientId: string) {
  return useQuery({
    queryKey: ["notifications", "settings", "whatsapp", "recipients", recipientId, "deliveries"],
    queryFn: () => apiGet<NotificationDelivery[]>(`/notifications/settings/whatsapp/recipients/${recipientId}/deliveries`),
    enabled: !!recipientId,
  });
}

export interface NotificationTemplate {
  tipo: string;
  titulo: string;
  corpo: string;
  critical: boolean;
  ativo: boolean;
  placeholders: { key: string; label: string }[];
  customized: boolean;
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ["notifications", "settings", "templates"],
    queryFn: () => apiGet<NotificationTemplate[]>("/notifications/settings/templates"),
  });
}

export function useUpdateNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, ...input }: { tipo: string; titulo?: string; corpo?: string; critical?: boolean; ativo?: boolean }) =>
      apiPatch<NotificationTemplate>(`/notifications/settings/templates/${tipo}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "settings", "templates"] }),
  });
}

export function useResetNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tipo: string) => apiDelete<NotificationTemplate>(`/notifications/settings/templates/${tipo}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", "settings", "templates"] }),
  });
}
