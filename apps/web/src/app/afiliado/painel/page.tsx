"use client";

import { useCurrentAffiliate, useMyCommissions, useMyReferrals } from "@/lib/affiliate-auth";
import { useI18n } from "@/lib/i18n";

export default function AfiliadoPainelPage() {
  const { t } = useI18n();
  const affiliate = useCurrentAffiliate();
  const commissions = useMyCommissions();
  const referrals = useMyReferrals();

  const linkUrl = affiliate.data && typeof window !== "undefined" ? `${window.location.origin}/cadastro?ref=${affiliate.data.linkCode}` : "";

  const paidTotal = (referrals.data ?? [])
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + Number(r.valorComissao ?? 0), 0);
  const pendingTotal = (referrals.data ?? [])
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + Number(r.valorComissao ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">
          {t("affiliate.panel.greeting")} {affiliate.data?.nome}
        </h1>
        <p className="mt-1 text-sm text-ink-dim">{t("affiliate.panel.subtitle")}</p>
      </div>

      {affiliate.data && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("affiliate.panel.myLink")}</p>
          <p className="mt-1 break-all font-mono text-sm text-brand-700">{linkUrl}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("affiliate.panel.paidTotal")}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {paidTotal.toLocaleString(undefined, { style: "currency", currency: "BRL" })}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("affiliate.panel.pendingTotal")}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {pendingTotal.toLocaleString(undefined, { style: "currency", currency: "BRL" })}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">{t("affiliate.panel.referrals")}</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-2">{t("affiliate.panel.columnEvent")}</th>
                <th className="px-4 py-2">{t("affiliate.panel.columnStatus")}</th>
                <th className="px-4 py-2">{t("affiliate.panel.columnCommission")}</th>
                <th className="px-4 py-2">{t("affiliate.panel.columnDate")}</th>
              </tr>
            </thead>
            <tbody>
              {referrals.data?.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">{r.evento}</td>
                  <td className="px-4 py-2 text-ink-dim">{r.status}</td>
                  <td className="px-4 py-2 text-ink-dim">
                    {r.valorComissao ? Number(r.valorComissao).toLocaleString(undefined, { style: "currency", currency: "BRL" }) : "—"}
                  </td>
                  <td className="px-4 py-2 text-ink-dim">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {referrals.data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                    {t("affiliate.panel.emptyReferrals")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">{t("affiliate.panel.commissionRules")}</h2>
        <div className="flex flex-wrap gap-2">
          {commissions.data?.map((c) => (
            <span key={c.id} className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-ink-dim">
              {c.tipo === "percentual" ? `${c.valor}%` : Number(c.valor).toLocaleString(undefined, { style: "currency", currency: "BRL" })}
              {c.recorrente ? ` · ${t("affiliate.panel.recurring")}` : ""}
            </span>
          ))}
          {commissions.data?.length === 0 && <p className="text-sm text-ink-faint">{t("affiliate.panel.emptyCommissions")}</p>}
        </div>
      </div>
    </div>
  );
}
