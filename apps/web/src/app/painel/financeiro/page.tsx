"use client";

import { useState } from "react";
import {
  useCancelSubscription,
  useInvoices,
  usePayInvoice,
  usePlans,
  useSubscribe,
  useSubscription,
  type Invoice,
  type PaymentMethod,
  type Plan,
} from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { SectionCard, StatCard } from "@/components/ui/stat-card";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export default function FinanceiroPage() {
  const { t, locale } = useI18n();
  const subscription = useSubscription();
  const invoices = useInvoices();
  const plans = usePlans();
  const subscribe = useSubscribe();
  const cancelSubscription = useCancelSubscription();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const overdueCount = invoices.data?.filter((invoice) => invoice.status === "overdue").length ?? 0;

  async function onSubscribe(planId: string) {
    setError(null);
    try {
      await subscribe.mutateAsync(planId);
    } catch {
      setError(t("financeiro.errorGeneric"));
    }
  }

  async function onCancel() {
    setError(null);
    try {
      await cancelSubscription.mutateAsync();
      setConfirmingCancel(false);
    } catch {
      setError(t("financeiro.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-ink">{t("financeiro.title")}</h1>

      <SectionCard title={t("financeiro.summary.title")}>
        <StatCard
          label={t("financeiro.summary.subscriptionStatus")}
          value={subscription.data ? t(`dashboard.financeiro.status.${subscription.data.status}` as DictionaryKey) : t("financeiro.noSubscription")}
        />
        <StatCard label={t("financeiro.summary.plan")} value={subscription.data?.plan.nome ?? t("dashboard.financeiro.noPlan")} />
        <StatCard label={t("financeiro.summary.overdueInvoices")} value={overdueCount} />
      </SectionCard>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{t("financeiro.currentPlan")}</h2>
        {subscription.isLoading ? (
          <p className="mt-2 text-sm text-ink-faint">{t("common.loading")}</p>
        ) : subscription.data ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-base font-medium text-ink">{subscription.data.plan.nome}</span>
              <SubscriptionStatusBadge status={subscription.data.status} />
            </div>
            {confirmingCancel ? (
              <div className="mt-3 flex items-center gap-2">
                <p className="text-sm text-ink-dim">{t("financeiro.cancelConfirm")}</p>
                <Button variant="danger" onClick={onCancel} loading={cancelSubscription.isPending}>
                  {t("financeiro.cancelConfirmYes")}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="mt-3 text-xs font-medium text-red-600 hover:underline"
              >
                {t("financeiro.cancelSubscription")}
              </button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">{t("financeiro.noSubscription")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{t("financeiro.availablePlans")}</h2>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.data?.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              current={subscription.data?.planId === plan.id}
              onSubscribe={() => onSubscribe(plan.id)}
              loading={subscribe.isPending}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink">{t("financeiro.invoices")}</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2">{t("financeiro.columnAmount")}</th>
                <th className="px-4 py-2">{t("financeiro.columnStatus")}</th>
                <th className="px-4 py-2">{t("financeiro.columnDue")}</th>
                <th className="px-4 py-2">{t("financeiro.columnPaidAt")}</th>
                <th className="px-4 py-2">{t("financeiro.columnMethod")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {invoices.data?.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} locale={locale} />
              ))}
              {invoices.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-ink-faint">
                    {t("financeiro.invoicesEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  onSubscribe,
  loading,
}: {
  plan: Plan;
  current: boolean;
  onSubscribe: () => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  const preco = Number(plan.preco).toLocaleString(undefined, { style: "currency", currency: "BRL" });
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${current ? "border-brand-500 bg-brand-50/40" : "border-line bg-surface"}`}>
      <p className="text-sm font-semibold text-ink">{plan.nome}</p>
      {plan.descricao && <p className="text-xs text-ink-dim">{plan.descricao}</p>}
      <p className="text-lg font-semibold text-ink">
        {preco}
        <span className="text-xs font-normal text-ink-faint">{plan.recorrencia === "anual" ? t("financeiro.perYear") : t("financeiro.perMonth")}</span>
      </p>
      <Button onClick={onSubscribe} disabled={current} loading={loading} variant={current ? "secondary" : "primary"}>
        {current ? t("financeiro.currentPlan") : t("financeiro.subscribe")}
      </Button>
    </div>
  );
}

function InvoiceRow({ invoice, locale }: { invoice: Invoice; locale: string }) {
  const { t } = useI18n();
  const payInvoice = usePayInvoice();
  const [metodo, setMetodo] = useState<PaymentMethod>("cartao");
  const canPay = invoice.status === "pending" || invoice.status === "overdue";
  const valor = Number(invoice.valor).toLocaleString(undefined, { style: "currency", currency: "BRL" });

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 font-medium text-ink">{valor}</td>
      <td className="px-4 py-2">
        <InvoiceStatusBadge status={invoice.status} />
      </td>
      <td className="px-4 py-2 text-ink-dim">{new Date(invoice.vencimento).toLocaleDateString(locale)}</td>
      <td className="px-4 py-2 text-ink-dim">{invoice.pagoEm ? new Date(invoice.pagoEm).toLocaleDateString(locale) : "—"}</td>
      <td className="px-4 py-2 text-ink-dim">{invoice.metodo ? t(`financeiro.method.${invoice.metodo}` as DictionaryKey) : "—"}</td>
      <td className="px-4 py-2 text-right">
        {canPay && (
          <div className="flex items-center justify-end gap-2">
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as PaymentMethod)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-xs"
            >
              <option value="cartao">{t("financeiro.method.cartao")}</option>
              <option value="pix">{t("financeiro.method.pix")}</option>
              <option value="boleto">{t("financeiro.method.boleto")}</option>
            </select>
            <button
              type="button"
              onClick={() =>
                payInvoice.mutate(
                  { id: invoice.id, metodo },
                  {
                    onSuccess: (result) => {
                      if (result.checkoutUrl) {
                        window.location.href = result.checkoutUrl;
                      }
                    },
                  },
                )
              }
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {t("financeiro.pay")}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-dim">
      {t(`dashboard.financeiro.status.${status}` as DictionaryKey)}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: Invoice["status"] }) {
  const { t } = useI18n();
  const classes: Record<Invoice["status"], string> = {
    pending: "bg-surface-muted text-ink-dim",
    paid: "bg-brand-50 text-brand-700",
    overdue: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    refunded: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    cancelled: "bg-surface-muted text-ink-faint",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {t(`financeiro.invoiceStatus.${status}` as DictionaryKey)}
    </span>
  );
}
