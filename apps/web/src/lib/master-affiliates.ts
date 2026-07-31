import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export type AffiliateStatus = "pending" | "approved" | "rejected" | "active" | "inactive" | "blocked";

export interface Affiliate {
  id: string;
  nome: string;
  sobrenome: string;
  cpf: string;
  email: string;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  status: AffiliateStatus;
  linkCode: string;
  aceitoTermosEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CommissionType = "percentual" | "fixo";

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  tipo: CommissionType;
  valor: string;
  recorrente: boolean;
  planId: string | null;
  moduleId: string | null;
  prazoLimiteDias: number | null;
  carenciaDias: number;
  minimoParaPagamento: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReferralEvent = "click" | "signup" | "subscription" | "renewal" | "cancellation" | "refund";
export type ReferralStatus = "pending" | "paid" | "reversed" | "clawback" | "clawback_settled";

export interface AffiliateReferral {
  id: string;
  affiliateId: string;
  tenantId: string | null;
  evento: ReferralEvent;
  planId: string | null;
  valorComissao: string | null;
  status: ReferralStatus;
  elegivelEm: string | null;
  createdAt: string;
}

export function useAffiliates() {
  return useQuery({ queryKey: ["master-affiliates"], queryFn: () => apiGet<Affiliate[]>("/master/affiliates") });
}

export function useAffiliate(id: string) {
  return useQuery({
    queryKey: ["master-affiliates", id],
    queryFn: () => apiGet<Affiliate>(`/master/affiliates/${id}`),
    enabled: !!id,
  });
}

export function useCreateAffiliate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; sobrenome: string; cpf: string; email: string; telefone?: string; whatsapp?: string; endereco?: string }) =>
      apiPost<Affiliate>("/master/affiliates", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-affiliates"] }),
  });
}

export function useUpdateAffiliateStatus(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: AffiliateStatus) => apiPatch<Affiliate>(`/master/affiliates/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-affiliates"] });
      queryClient.invalidateQueries({ queryKey: ["master-affiliates", id] });
    },
  });
}

export function useSetAffiliatePassword(id: string) {
  return useMutation({
    mutationFn: (senha: string) => apiPatch<{ id: string; passwordSet: boolean }>(`/master/affiliates/${id}/password`, { senha }),
  });
}

export function useAffiliateCommissions(id: string) {
  return useQuery({
    queryKey: ["master-affiliates", id, "commissions"],
    queryFn: () => apiGet<AffiliateCommission[]>(`/master/affiliates/${id}/commissions`),
    enabled: !!id,
  });
}

export function useCreateCommission(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tipo: CommissionType;
      valor: number;
      recorrente?: boolean;
      planId?: string;
      moduleId?: string;
      prazoLimiteDias?: number;
      carenciaDias?: number;
      minimoParaPagamento?: number;
    }) => apiPost<AffiliateCommission>(`/master/affiliates/${id}/commissions`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-affiliates", id, "commissions"] }),
  });
}

export function useAffiliateReferrals(id: string) {
  return useQuery({
    queryKey: ["master-affiliates", id, "referrals"],
    queryFn: () => apiGet<AffiliateReferral[]>(`/master/affiliates/${id}/referrals`),
    enabled: !!id,
  });
}

export function usePayEligibleReferrals(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<{ quantidade: number; total: string; clawbackDeduzido: string }>(`/master/affiliates/${id}/referrals/pay-eligible`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["master-affiliates", id, "referrals"] }),
  });
}
