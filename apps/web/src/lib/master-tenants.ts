import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export type TenantStatus = "trial" | "active" | "suspended" | "blocked" | "cancelled";

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
    queryFn: () => apiGet<{ tenantUsers: number; files: number }>(`/master/tenants/${id}/consumption`),
    enabled: !!id,
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
