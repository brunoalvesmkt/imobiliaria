import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export type TenantStatus = "trial" | "active" | "suspended" | "blocked" | "cancelled";

export interface TenantStorageUsage {
  usedBytes: number;
  limitMb: number | null;
  unlimited: boolean;
  percentage: number | null;
  categories: { imagensVideos: number; audios: number; documentos: number; outros: number };
  updatedAt: string | null;
}

export interface MasterTenant {
  id: string;
  razaoSocial: string;
  cnpj: string;
  responsavel: string;
  endereco: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string;
  logoUrl: string | null;
  subdominio: string;
  dominioCustom: string | null;
  status: TenantStatus;
  planId: string | null;
  createdAt: string;
  updatedAt: string;
  plan: { id: string; nome: string } | null;
  impersonationActive: boolean;
  hasOverdueInvoices: boolean;
  storage: TenantStorageUsage | null;
}

export interface MasterTenantDetail extends MasterTenant {
  featureFlags: { id: string; module: string; enabled: boolean; config: Record<string, unknown> | null }[];
  subscriptions: { id: string; status: string; createdAt: string }[];
}

export function useMasterTenants(status?: TenantStatus) {
  const qs = status ? `?status=${status}` : "";
  return useQuery({
    queryKey: ["master-tenants", status ?? ""],
    queryFn: () => apiGet<MasterTenant[]>(`/master/tenants${qs}`),
  });
}

export function useCreateManualTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { razaoSocial: string; cnpj: string; responsavel: string; email: string; senha: string; planId?: string }) =>
      apiPost<MasterTenant>("/master/tenants", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-tenants"] }),
  });
}

export function useMasterTenant(id: string) {
  return useQuery({
    queryKey: ["master-tenants", id],
    queryFn: () => apiGet<MasterTenantDetail>(`/master/tenants/${id}`),
    enabled: !!id,
  });
}

export function useTenantConsumption(id: string) {
  return useQuery({
    queryKey: ["master-tenants", id, "consumption"],
    queryFn: () => apiGet<{ tenantUsers: number; files: number; storage: TenantStorageUsage | null }>(`/master/tenants/${id}/consumption`),
    enabled: !!id,
  });
}

export function useUpdateTenantStorageLimit(id: string) {
  const invalidate = useInvalidateTenant(id);
  return useMutation({
    mutationFn: (input: { storageLimitMb: number | null; storageUnlimited: boolean }) =>
      apiPatch<{ storageLimitMb: number | null; storageUnlimited: boolean }>(`/master/tenants/${id}/storage-limit`, input),
    onSuccess: invalidate,
  });
}

export function useRecalculateTenantStorage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<TenantStorageUsage>(`/master/tenants/${id}/storage-recalculate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-tenants", id, "consumption"] });
      queryClient.invalidateQueries({ queryKey: ["master-tenants"] });
    },
  });
}

function useInvalidateTenant(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["master-tenants"] });
    queryClient.invalidateQueries({ queryKey: ["master-tenants", id] });
  };
}

export function useUpdateTenantStatus(id: string) {
  const invalidate = useInvalidateTenant(id);
  return useMutation({
    mutationFn: (status: TenantStatus) => apiPatch<MasterTenant>(`/master/tenants/${id}/status`, { status }),
    onSuccess: invalidate,
  });
}

export function useUpdateTenantPlan(id: string) {
  const invalidate = useInvalidateTenant(id);
  return useMutation({
    mutationFn: (planId: string) => apiPatch<MasterTenant>(`/master/tenants/${id}/plan`, { planId }),
    onSuccess: invalidate,
  });
}

export function useImpersonateTenant(id: string) {
  return useMutation({
    mutationFn: (accessLevel: "read" | "read_write") =>
      apiPost<{ tenantId: string; accessLevel: "read" | "read_write" }>(`/master/tenants/${id}/impersonate`, {
        accessLevel,
      }),
  });
}

export interface TenantLoginAccess {
  id: string | null;
  nome: string | null;
  email: string | null;
}

export function useTenantLoginAccess(id: string) {
  return useQuery({
    queryKey: ["master-tenants", id, "login-access"],
    queryFn: () => apiGet<TenantLoginAccess>(`/master/tenants/${id}/login-access`),
    enabled: !!id,
  });
}

export function useUpdateTenantLoginEmail(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => apiPatch<TenantLoginAccess>(`/master/tenants/${id}/login-email`, { email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-tenants", id, "login-access"] }),
  });
}

export function useResendTenantPasswordReset(id: string) {
  return useMutation({
    mutationFn: () => apiPost<{ sent: boolean }>(`/master/tenants/${id}/password-reset`, {}),
  });
}

export function useUpdateTenantModule(id: string) {
  const invalidate = useInvalidateTenant(id);
  return useMutation({
    mutationFn: (input: { module: string; enabled: boolean; config?: Record<string, unknown> }) =>
      apiPatch<{ id: string; module: string; enabled: boolean; config: Record<string, unknown> | null }>(
        `/master/tenants/${id}/modules`,
        input,
      ),
    onSuccess: invalidate,
  });
}
