import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export interface RolePermission {
  module: string;
  action: string;
}

export interface Role {
  id: string;
  nome: string;
  descricao: string | null;
  isSystem: boolean;
  ativo: boolean;
}

export interface RoleWithPermissions extends Role {
  permissions: RolePermission[];
  _count: { users: number };
}

export interface PermissionOptions {
  modules: string[];
  actions: string[];
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => apiGet<Role[]>("/roles") });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: ["roles", id],
    queryFn: () => apiGet<RoleWithPermissions>(`/roles/${id}`),
    enabled: !!id,
  });
}

export function usePermissionOptions() {
  return useQuery({ queryKey: ["roles", "permission-options"], queryFn: () => apiGet<PermissionOptions>("/roles/permission-options") });
}

export interface RoleInput {
  nome: string;
  descricao?: string | undefined;
  ativo?: boolean;
  permissions: RolePermission[];
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RoleInput) => apiPost<RoleWithPermissions>("/roles", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<RoleInput>) => apiPatch<RoleWithPermissions>(`/roles/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, substitutaRoleId }: { id: string; substitutaRoleId?: string | undefined }) =>
      apiDelete<{ status: "ok" }>(`/roles/${id}${substitutaRoleId ? `?substitutaRoleId=${substitutaRoleId}` : ""}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}
