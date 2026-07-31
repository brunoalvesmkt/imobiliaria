import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export type TemplateStatus = "draft" | "pending" | "approved" | "rejected";

export type TemplateCategory = "marketing" | "utility" | "authentication";

export interface WhatsAppTemplate {
  id: string;
  nome: string;
  idioma: string;
  categoria: TemplateCategory;
  cabecalho: string | null;
  corpo: string;
  rodape: string | null;
  status: TemplateStatus;
  versao: number;
  whatsAppNumberId: string | null;
  createdAt: string;
}

export interface CreateTemplateInput {
  nome: string;
  idioma?: string;
  categoria: TemplateCategory;
  cabecalho?: string;
  corpo: string;
  rodape?: string;
}

export function useTemplates() {
  return useQuery({
    queryKey: ["whatsapp", "templates"],
    queryFn: () => apiGet<WhatsAppTemplate[]>("/whatsapp/templates"),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => apiPost<WhatsAppTemplate>("/whatsapp/templates", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] }),
  });
}

export function useUpdateTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CreateTemplateInput>) => apiPatch<WhatsAppTemplate>(`/whatsapp/templates/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] }),
  });
}

export function useSubmitTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<WhatsAppTemplate>(`/whatsapp/templates/${id}/submit`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] }),
  });
}

export function useApproveTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<WhatsAppTemplate>(`/whatsapp/templates/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] }),
  });
}

export function useRejectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<WhatsAppTemplate>(`/whatsapp/templates/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] }),
  });
}
