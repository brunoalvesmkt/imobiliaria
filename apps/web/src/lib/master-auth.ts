import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export type MasterRole = "super_admin" | "financeiro" | "suporte";

export interface CurrentMasterUser {
  type: "master";
  id: string;
  masterRole: MasterRole;
  nome: string | null;
  email: string | null;
}

export function useCurrentMasterUser() {
  return useQuery({
    queryKey: ["master-auth", "me"],
    queryFn: () => apiGet<CurrentMasterUser>("/auth/master/me"),
    retry: false,
  });
}

export interface MasterLoginInput {
  email: string;
  senha: string;
}

export function useMasterLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MasterLoginInput) => apiPost<{ status: "ok" }>("/auth/master/login", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-auth"] }),
  });
}

export function useMasterLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ status: "ok" }>("/auth/master/logout"),
    onSuccess: () => queryClient.clear(),
  });
}

export type MasterUserStatus = "active" | "inactive";

export interface MasterUser {
  id: string;
  nome: string;
  email: string;
  role: MasterRole;
  status: MasterUserStatus;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

export function useMasterUsers() {
  return useQuery({ queryKey: ["master-users"], queryFn: () => apiGet<MasterUser[]>("/master/master-users") });
}

export function useCreateMasterUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; email: string; senha: string; role: MasterRole }) =>
      apiPost<MasterUser>("/master/master-users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-users"] }),
  });
}

export function useUpdateMasterUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string; role?: MasterRole; status?: MasterUserStatus }) =>
      apiPatch<MasterUser>(`/master/master-users/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-users"] }),
  });
}
