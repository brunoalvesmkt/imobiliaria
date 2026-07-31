import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api-client";

export interface CurrentAffiliate {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
  status: string;
  linkCode: string;
}

export function useCurrentAffiliate() {
  return useQuery({
    queryKey: ["affiliate-auth", "me"],
    queryFn: () => apiGet<CurrentAffiliate>("/auth/affiliate/me"),
    retry: false,
  });
}

export interface AffiliateLoginInput {
  email: string;
  senha: string;
}

export function useAffiliateLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AffiliateLoginInput) => apiPost<{ status: "ok" }>("/auth/affiliate/login", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["affiliate-auth"] }),
  });
}

export function useAffiliateLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<{ status: "ok" }>("/auth/affiliate/logout"),
    onSuccess: () => queryClient.clear(),
  });
}

export interface AffiliateCommission {
  id: string;
  tipo: string;
  valor: string;
  recorrente: boolean;
  createdAt: string;
}

export function useMyCommissions() {
  return useQuery({
    queryKey: ["affiliate-auth", "commissions"],
    queryFn: () => apiGet<AffiliateCommission[]>("/affiliate/me/commissions"),
  });
}

export interface AffiliateReferral {
  id: string;
  evento: string;
  status: string;
  valorComissao: string | null;
  tenantId: string | null;
  createdAt: string;
}

export function useMyReferrals() {
  return useQuery({
    queryKey: ["affiliate-auth", "referrals"],
    queryFn: () => apiGet<AffiliateReferral[]>("/affiliate/me/referrals"),
  });
}
