"use client";

import { useState } from "react";
import Link from "next/link";
import { useCreateManualTenant, useMasterTenants, type MasterTenant } from "@/lib/master-tenants";
import { useMasterPlans } from "@/lib/master-plans";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { apiUrl, ApiError } from "@/lib/api-client";
import { StatusBadge } from "./status-badge";
import { formatCpfCnpj } from "@/lib/cpf-cnpj";
import { formatGb, formatLimitGb, storageStatus, STORAGE_STATUS_TEXT_CLASSES } from "@/lib/storage";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

type StorageFilter = "all" | "80" | "90" | "100";

const STORAGE_FILTER_LABEL_KEY: Record<StorageFilter, DictionaryKey> = {
  all: "master.tenants.storageFilter.all",
  "80": "master.tenants.storageFilter.above80",
  "90": "master.tenants.storageFilter.above90",
  "100": "master.tenants.storageFilter.atLimit",
};

export default function MasterTenantsPage() {
  const { t } = useI18n();
  const tenants = useMasterTenants();
  const [showForm, setShowForm] = useState(false);
  const [storageFilter, setStorageFilter] = useState<StorageFilter>("all");

  const filteredTenants = (tenants.data ?? []).filter((tenant) => {
    if (storageFilter === "all") return true;
    // Tenants ilimitados nunca entram em nenhuma faixa (percentage é null).
    if (!tenant.storage || tenant.storage.percentage == null) return false;
    const threshold = Number(storageFilter);
    return tenant.storage.percentage >= threshold;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink">{t("master.tenants.title")}</h1>
        <div className="flex items-center gap-3">
          <a href={apiUrl("/master/tenants/export")} className="text-sm text-accent hover:underline">
            {t("master.export.csv")}
          </a>
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("master.tenants.new")}</Button>
        </div>
      </div>

      {showForm && <NewTenantForm onDone={() => setShowForm(false)} />}

      <div className="flex items-center gap-1">
        {(["all", "80", "90", "100"] as StorageFilter[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStorageFilter(option)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              storageFilter === option ? "bg-brand-600 text-white" : "bg-surface-muted text-ink-dim hover:bg-surface-alt"
            }`}
          >
            {t(STORAGE_FILTER_LABEL_KEY[option])}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("master.tenants.columnName")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnCnpj")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnStatus")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnPlan")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnStorage")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((tenant) => (
              <TenantRow key={tenant.id} tenant={tenant} />
            ))}
            {filteredTenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TenantRow({ tenant }: { tenant: MasterTenant }) {
  const { t, locale } = useI18n();
  const status = storageStatus(tenant.storage?.percentage ?? null);
  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 font-medium text-ink">
        <Link href={`/master/painel/empresas/${tenant.id}`} className="hover:underline">
          {tenant.razaoSocial}
        </Link>
        {tenant.impersonationActive && (
          <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            {t("master.tenants.impersonationActive")}
          </span>
        )}
        {tenant.hasOverdueInvoices && (
          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-900 dark:bg-red-950/60 dark:text-red-200">
            {t("master.tenants.overdue")}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-ink-dim">{formatCpfCnpj(tenant.cnpj)}</td>
      <td className="px-4 py-2">
        <StatusBadge status={tenant.status} />
      </td>
      <td className="px-4 py-2 text-ink-dim">{tenant.plan?.nome ?? t("master.tenants.noPlan")}</td>
      <td className={`px-4 py-2 ${STORAGE_STATUS_TEXT_CLASSES[status]}`}>
        {tenant.storage
          ? `${formatGb(tenant.storage.usedBytes, locale)} / ${formatLimitGb(tenant.storage.limitMb, tenant.storage.unlimited, locale, t("storage.unlimited"))}`
          : "—"}
      </td>
    </tr>
  );
}

function NewTenantForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const plans = useMasterPlans();
  const createTenant = useCreateManualTenant();
  const [form, setForm] = useState({ razaoSocial: "", cnpj: "", responsavel: "", email: "", senha: "", planId: "" });
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { planId, ...rest } = form;
      await createTenant.mutateAsync({ ...rest, ...(planId ? { planId } : {}) });
      setForm({ razaoSocial: "", cnpj: "", responsavel: "", email: "", senha: "", planId: "" });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("master.tenants.errorGeneric"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label={t("master.tenants.razaoSocial")}
          required
          value={form.razaoSocial}
          onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
        />
        <Field label={t("master.tenants.cnpj")} required value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
        <Field
          label={t("master.tenants.responsavel")}
          required
          value={form.responsavel}
          onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
        />
        <Field
          label={t("master.tenants.email")}
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Field
          label={t("master.tenants.password")}
          type="password"
          required
          minLength={10}
          value={form.senha}
          onChange={(e) => setForm({ ...form, senha: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("master.tenants.columnPlan")}</label>
          <select
            value={form.planId}
            onChange={(e) => setForm({ ...form, planId: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("master.tenants.noPlan")}</option>
            {plans.data?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Button type="submit" loading={createTenant.isPending}>
          {t("master.tenants.create")}
        </Button>
      </div>
    </form>
  );
}
