import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api-client";

export interface ImpersonationClaim {
  masterUserId: string;
  accessLevel: "read" | "read_write";
}

export interface CurrentUser {
  type: "tenant" | "master";
  id: string;
  tenantId?: string;
  roleId?: string;
  impersonation?: ImpersonationClaim;
  /** `false` enquanto o e-mail da empresa não foi confirmado (documento de alterações, seção 4). Omitido quando confirmado. */
  emailConfirmed?: boolean;
}

export interface MyProfile {
  id: string;
  nome: string;
  email: string;
  roleId: string;
  status: string;
  twoFactorEnabled?: boolean;
  /** Papel com a permissão `configuracoes:administer` — usado para esconder botões administrativos (ex.: "Configurações") de usuários comuns. */
  isAdmin: boolean;
  /** Papel com a permissão `atendimento:administer` — usado para esconder Editar/Inativar/Excluir em Equipes e Filas de usuários comuns do módulo. */
  atendimentoAdmin: boolean;
}

export interface TenantInfo {
  id: string;
  razaoSocial: string;
  subdominio: string;
  status: string;
  createdAt: string;
  email: string;
  emailConfirmado: boolean;
}

export interface FeatureFlagInfo {
  module: string;
  enabled: boolean;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<CurrentUser>("/auth/tenant/me"),
    retry: false,
  });
}

export function useMyProfile(enabled: boolean) {
  return useQuery({
    queryKey: ["tenant-users", "me"],
    queryFn: () => apiGet<MyProfile>("/tenant-users/me"),
    enabled,
  });
}

/** Botões administrativos (ex.: "Configurações" nas abas do CRM) só aparecem para quem tem `configuracoes:administer`. */
export function useIsAdmin(): boolean {
  const profile = useMyProfile(true);
  return profile.data?.isAdmin ?? false;
}

/** Editar/Inativar/Excluir em Equipes e Filas (módulo Atendimento) só aparecem para quem tem `atendimento:administer`. */
export function useIsAtendimentoAdmin(): boolean {
  const profile = useMyProfile(true);
  return profile.data?.atendimentoAdmin ?? false;
}

export function useTenantInfo(enabled: boolean) {
  return useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => apiGet<TenantInfo>("/tenants/me"),
    enabled,
  });
}

export function useActiveModules(enabled: boolean) {
  return useQuery({
    queryKey: ["tenants", "me", "features"],
    queryFn: () => apiGet<FeatureFlagInfo[]>("/tenants/me/features"),
    enabled,
    select: (flags) => new Set(flags.filter((f) => f.enabled).map((f) => f.module)),
  });
}

/** Ordem dos módulos no menu lateral, definida pelo Master em "Configurações para Empresas". */
export function useModuleOrder(enabled: boolean) {
  return useQuery({
    queryKey: ["tenants", "me", "module-order"],
    queryFn: () => apiGet<{ moduleOrder: string[] }>("/tenants/me/module-order"),
    enabled,
    select: (data) => data.moduleOrder,
  });
}

export interface LoginInput {
  email: string;
  senha: string;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiPost<{ status: "ok" | "2fa_required" }>("/auth/tenant/login", input),
    onSuccess: (result) => {
      if (result.status === "ok") queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

export function useVerifyTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (codigo: string) => apiPost<{ status: "ok" }>("/auth/tenant/2fa/verify", { codigo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}

export interface SignupInput {
  razaoSocial: string;
  cnpj: string;
  responsavel: string;
  telefone: string;
  whatsapp: string;
  segmentoId: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  email: string;
  confirmacaoEmail: string;
  senha: string;
  confirmacaoSenha: string;
  planId: string;
  periodicidade: "mensal" | "anual";
  affiliateLinkCode?: string;
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => apiPost<{ status: "ok" }>("/auth/tenant/signup", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ status: "ok" }>("/auth/tenant/logout"),
    onSuccess: () => queryClient.clear(),
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => apiPost<{ status: "ok" }>("/auth/tenant/password-reset/request", { email }),
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (input: { token: string; novaSenha: string }) =>
      apiPost<{ status: "ok" }>("/auth/tenant/password-reset/confirm", input),
  });
}
