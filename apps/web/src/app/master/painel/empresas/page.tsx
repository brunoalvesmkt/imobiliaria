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

export default function MasterTenantsPage() {
  const { t } = useI18n();
  const tenants = useMasterTenants();
  const [showForm, setShowForm] = useState(false);

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

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("master.tenants.columnName")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnCnpj")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnStatus")}</th>
              <th className="px-4 py-2">{t("master.tenants.columnPlan")}</th>
            </tr>
          </thead>
          <tbody>
            {tenants.data?.map((tenant) => (
              <TenantRow key={tenant.id} tenant={tenant} />
            ))}
            {tenants.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
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
  const { t } = useI18n();
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
