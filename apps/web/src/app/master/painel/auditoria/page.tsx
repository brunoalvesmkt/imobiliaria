"use client";

import { useState } from "react";
import { useMasterAuditLog } from "@/lib/audit-log";
import { useI18n } from "@/lib/i18n";

export default function MasterAuditLogPage() {
  const { t, locale } = useI18n();
  const [tenantId, setTenantId] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const logs = useMasterAuditLog({ tenantId: tenantId || undefined, entity: entity || undefined, action: action || undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("auditLog.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("auditLog.masterSubtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder={t("auditLog.filterTenantId")}
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t("auditLog.filterEntity")}
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder={t("auditLog.filterAction")}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("auditLog.columnWhen")}</th>
              <th className="px-4 py-2">{t("auditLog.columnAction")}</th>
              <th className="px-4 py-2">{t("auditLog.columnEntity")}</th>
              <th className="px-4 py-2">{t("auditLog.columnTenant")}</th>
              <th className="px-4 py-2">{t("auditLog.columnActor")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.data?.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 text-ink-dim">{new Date(entry.timestamp).toLocaleString(locale)}</td>
                <td className="px-4 py-2 font-medium text-ink">{entry.action}</td>
                <td className="px-4 py-2 text-ink-dim">
                  {entry.entity}
                  {entry.entityId && <span className="text-ink-faint"> #{entry.entityId.slice(0, 8)}</span>}
                </td>
                <td className="px-4 py-2 text-ink-faint">{entry.tenantId ? `${entry.tenantId.slice(0, 8)}…` : "—"}</td>
                <td className="px-4 py-2 text-ink-dim">
                  {entry.actorType === "master" ? t("auditLog.actorMaster") : t("auditLog.actorTenantUser")}
                </td>
              </tr>
            ))}
            {logs.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                  {t("auditLog.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
