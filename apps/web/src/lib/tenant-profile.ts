import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "./api-client";

/** Meus Dados (documento de alterações, item 7) — mesmo registro principal usado na contratação. */
export interface TenantProfile {
  id: string;
  razaoSocial: string;
  cnpj: string;
  responsavel: string;
  telefone: string | null;
  whatsapp: string | null;
  segmentoId: string | null;
  segmento: { id: string; nome: string } | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  email: string;
  emailConfirmado: boolean;
  canEdit: boolean;
  subscriptions: {
    recorrenciaContratada: string | null;
    status: string;
    plan: { nome: string } | null;
  }[];
}

export type UpdateTenantProfileInput = Partial<
  Pick<TenantProfile, "razaoSocial" | "responsavel" | "telefone" | "whatsapp" | "segmentoId" | "endereco" | "numero" | "bairro" | "cidade" | "uf" | "cep">
>;

export function useTenantProfile() {
  return useQuery({ queryKey: ["tenants", "me", "profile"], queryFn: () => apiGet<TenantProfile>("/tenants/me/profile") });
}

export function useUpdateTenantProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTenantProfileInput) => apiPatch<TenantProfile>("/tenants/me/profile", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenants", "me"] }),
  });
}
