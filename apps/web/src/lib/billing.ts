import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./api-client";

export interface Plan {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  recorrencia: "mensal" | "anual";
  modulos: string[];
  limites: Record<string, unknown>;
  iaIncluida: boolean;
  apiOficial: boolean;
  ativo: boolean;
}

export type SubscriptionStatus = "waiting" | "active" | "overdue" | "delinquent" | "suspended" | "cancelled" | "refunded";

export interface Subscription {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string | null;
  renewedAt: string | null;
  cancelledAt: string | null;
  plan: Plan;
}

export type InvoiceStatus = "pending" | "paid" | "overdue" | "refunded" | "cancelled";
export type PaymentMethod = "pix" | "boleto" | "cartao";

export interface Invoice {
  id: string;
  subscriptionId: string;
  valor: string;
  status: InvoiceStatus;
  vencimento: string;
  pagoEm: string | null;
  metodo: string | null;
  gatewayRef: string | null;
  motivoEstorno: string | null;
  createdAt: string;
  subscription: { plan: Plan };
}

export function usePlans() {
  return useQuery({ queryKey: ["billing", "plans"], queryFn: () => apiGet<Plan[]>("/billing/plans") });
}

export function useSubscription() {
  return useQuery({ queryKey: ["billing", "subscription"], queryFn: () => apiGet<Subscription | null>("/billing/subscription") });
}

export function useInvoices() {
  return useQuery({ queryKey: ["billing", "invoices"], queryFn: () => apiGet<Invoice[]>("/billing/invoices") });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => apiPost<{ subscription: Subscription; invoice: Invoice }>("/billing/subscribe", { planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Subscription>("/billing/cancel"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
    },
  });
}

export function usePayInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, metodo }: { id: string; metodo: PaymentMethod }) =>
      apiPost<Invoice & { checkoutUrl?: string }>(`/billing/invoices/${id}/pay`, { metodo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
    },
  });
}
