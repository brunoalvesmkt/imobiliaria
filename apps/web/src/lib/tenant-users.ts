import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface TenantUser {
  id: string;
  nome: string;
  email: string;
  roleId: string;
  status: "active" | "inactive";
  lastLoginAt: string | null;
  createdAt: string;
}

export function useTenantUsers() {
  return useQuery({ queryKey: ["tenant-users"], queryFn: () => apiGet<TenantUser[]>("/tenant-users") });
}

export interface CreateTenantUserInput {
  nome: string;
  email: string;
  senha: string;
  roleId: string;
}

export function useCreateTenantUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTenantUserInput) => apiPost<TenantUser>("/tenant-users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users"] }),
  });
}

export function useUpdateTenantUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string; roleId?: string; status?: "active" | "inactive" }) =>
      apiPatch<TenantUser>(`/tenant-users/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users"] }),
  });
}

export function useDeleteTenantUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/tenant-users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users"] }),
  });
}
