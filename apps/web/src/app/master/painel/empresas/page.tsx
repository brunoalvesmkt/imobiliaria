"use client";

import Link from "next/link";
import { useMasterTenants, type MasterTenant } from "@/lib/master-tenants";
import { useI18n } from "@/lib/i18n";
import { apiUrl } from "@/lib/api-client";
import { StatusBadge } from "./status-badge";

export default function MasterTenantsPage() {
  const { t } = useI18n();
  const tenants = useMasterTenants();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-ink">{t("master.tenants.title")}</h1>
        <a href={apiUrl("/master/tenants/export")} className="text-sm text-accent hover:underline">
          {t("master.export.csv")}
        </a>
      </div>

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
      </td>
      <td className="px-4 py-2 text-ink-dim">{tenant.cnpj}</td>
      <td className="px-4 py-2">
        <StatusBadge status={tenant.status} />
      </td>
      <td className="px-4 py-2 text-ink-dim">{tenant.plan?.nome ?? t("master.tenants.noPlan")}</td>
    </tr>
  );
}
