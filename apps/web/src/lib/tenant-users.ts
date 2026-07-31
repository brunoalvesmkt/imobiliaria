import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

export interface TenantUser {
  id: string;
  nome: string;
  email: string;
}

export function useTenantUsers() {
  return useQuery({ queryKey: ["tenant-users"], queryFn: () => apiGet<TenantUser[]>("/tenant-users") });
}
