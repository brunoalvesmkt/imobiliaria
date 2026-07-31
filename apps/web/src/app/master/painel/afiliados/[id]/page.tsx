"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useAffiliate,
  useAffiliateCommissions,
  useAffiliateReferrals,
  useCreateCommission,
  usePayEligibleReferrals,
  useSetAffiliatePassword,
  useUpdateAffiliateStatus,
  type AffiliateStatus,
  type CommissionType,
} from "@/lib/master-affiliates";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { AffiliateStatusBadge } from "../status-badge";

const STATUSES: AffiliateStatus[] = ["pending", "approved", "rejected", "active", "inactive", "blocked"];

export default function MasterAffiliateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t, locale } = useI18n();
  const affiliate = useAffiliate(id);
  const commissions = useAffiliateCommissions(id);
  const referrals = useAffiliateReferrals(id);
  const updateStatus = useUpdateAffiliateStatus(id);
  const payEligible = usePayEligibleReferrals(id);
  const [payResult, setPayResult] = useState<{ quantidade: number; total: string; clawbackDeduzido: string } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [showCommissionForm, setShowCommissionForm] = useState(false);

  async function onPayEligible() {
    setPayResult(null);
    setPayError(null);
    try {
      const result = await payEligible.mutateAsync();
      setPayResult(result);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t("master.affiliates.errorGeneric"));
    }
  }

  if (affiliate.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (!affiliate.data) return null;
  const data = affiliate.data;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/master/painel/afiliados" className="text-xs font-medium text-ink-dim hover:text-ink">
        ← {t("master.affiliates.back")}
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">
          {data.nome} {data.sobrenome}
        </h1>
        <AffiliateStatusBadge status={data.status} />
      </div>
      <p className="text-sm text-ink-dim">
        {data.email} · <span className="font-mono text-xs">{data.linkCode}</span>
      </p>

      <section className="rounded-lg border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">{t("master.affiliates.changeStatus")}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              disabled={status === data.status}
              onClick={() => updateStatus.mutate(status)}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-alt disabled:opacity-40"
            >
              {t(`master.affiliates.status.${status}` as DictionaryKey)}
            </button>
          ))}
        </div>
      </section>

      <SetPasswordSection affiliateId={id} />

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("master.affiliates.commissions")}</h2>
          <button type="button" onClick={() => setShowCommissionForm((v) => !v)} className="text-xs font-medium text-brand-700 hover:underline">
            {showCommissionForm ? t("common.cancel") : t("master.affiliates.addCommission")}
          </button>
        </div>
        {showCommissionForm && <NewCommissionForm affiliateId={id} onDone={() => setShowCommissionForm(false)} />}
        <ul className="flex flex-col gap-1.5">
          {commissions.data?.map((c) => (
            <li key={c.id} className="flex justify-between rounded-md bg-surface-alt px-3 py-2 text-sm">
              <span className="text-ink-dim">{t(`master.affiliates.commissionType.${c.tipo}` as DictionaryKey)}</span>
              <span className="font-medium text-ink">{c.tipo === "percentual" ? `${c.valor}%` : `R$ ${c.valor}`}</span>
            </li>
          ))}
          {commissions.data?.length === 0 && <p className="text-sm text-ink-faint">—</p>}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{t("master.affiliates.referrals")}</h2>
          <Button variant="secondary" onClick={onPayEligible} loading={payEligible.isPending}>
            {t("master.affiliates.payEligible")}
          </Button>
        </div>
        {payError && <Alert tone="error">{payError}</Alert>}
        {payResult && (
          <Alert tone="success">
            {t("master.affiliates.payEligibleResult")
              .replace("{count}", String(payResult.quantidade))
              .replace("{total}", payResult.total)}
            {Number(payResult.clawbackDeduzido) > 0 && (
              <p className="mt-1 text-xs">
                {t("master.affiliates.payEligibleClawbackNote").replace("{clawback}", payResult.clawbackDeduzido)}
              </p>
            )}
          </Alert>
        )}
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2">{t("master.affiliates.columnEvent")}</th>
                <th className="px-3 py-2">{t("master.affiliates.columnCommissionValue")}</th>
                <th className="px-3 py-2">{t("master.affiliates.columnReferralStatus")}</th>
                <th className="px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {referrals.data?.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink-dim">{r.evento}</td>
                  <td className="px-3 py-2 text-ink">{r.valorComissao ? `R$ ${r.valorComissao}` : "—"}</td>
                  <td className="px-3 py-2 text-ink-dim">{r.status}</td>
                  <td className="px-3 py-2 text-ink-faint">{new Date(r.createdAt).toLocaleDateString(locale)}</td>
                </tr>
              ))}
              {referrals.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-ink-faint">
                    {t("master.affiliates.referralsEmpty")}
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

function SetPasswordSection({ affiliateId }: { affiliateId: string }) {
  const { t } = useI18n();
  const setPassword = useSetAffiliatePassword(affiliateId);
  const [senha, setSenha] = useState("");
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    try {
      await setPassword.mutateAsync(senha);
      setSenha("");
      setSuccess(true);
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-ink">{t("master.affiliates.setPassword.title")}</h2>
      <p className="text-xs text-ink-faint">{t("master.affiliates.setPassword.description")}</p>
      {setPassword.error && <Alert tone="error">{t("master.affiliates.setPassword.errorGeneric")}</Alert>}
      {success && <Alert tone="success">{t("master.affiliates.setPassword.success")}</Alert>}
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <Field
          label={t("master.affiliates.setPassword.label")}
          type="password"
          minLength={10}
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <Button type="submit" loading={setPassword.isPending}>
          {t("master.affiliates.setPassword.submit")}
        </Button>
      </form>
    </section>
  );
}

function NewCommissionForm({ affiliateId, onDone }: { affiliateId: string; onDone: () => void }) {
  const { t } = useI18n();
  const createCommission = useCreateCommission(affiliateId);
  const [tipo, setTipo] = useState<CommissionType>("percentual");
  const [valor, setValor] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createCommission.mutateAsync({ tipo, valor: Number(valor) });
      setValor("");
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 rounded-md bg-surface-alt p-3">
      {createCommission.error && <Alert tone="error">{t("master.affiliates.errorGeneric")}</Alert>}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("master.affiliates.commissionType")}</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as CommissionType)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="percentual">{t("master.affiliates.commissionType.percentual")}</option>
          <option value="fixo">{t("master.affiliates.commissionType.fixo")}</option>
        </select>
      </div>
      <Field label={t("master.affiliates.commissionValue")} type="number" min="0" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} />
      <Button type="submit" loading={createCommission.isPending}>
        {t("master.affiliates.addCommission")}
      </Button>
    </form>
  );
}
