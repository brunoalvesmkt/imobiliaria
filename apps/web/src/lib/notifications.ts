import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "./api-client";
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
  destinoNumero: string | null;
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
