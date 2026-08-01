"use client";

import { useState } from "react";
import { useAuditLog, type AuditLogEntry } from "@/lib/audit-log";
import { useI18n } from "@/lib/i18n";

export default function AuditLogPage() {
  const { t, locale } = useI18n();
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const logs = useAuditLog({ entity: entity || undefined, action: action || undefined });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("auditLog.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("auditLog.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-3">
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
              <th className="px-4 py-2">{t("auditLog.columnActor")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.data?.map((entry) => (
              <AuditRow key={entry.id} entry={entry} locale={locale} />
            ))}
            {logs.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
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

function AuditRow({ entry, locale }: { entry: AuditLogEntry; locale: string }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const hasDetails = entry.previousData || entry.newData;

  return (
    <>
      <tr
        className={`border-b border-line last:border-0 ${hasDetails ? "cursor-pointer hover:bg-surface-alt" : ""}`}
        onClick={() => hasDetails && setExpanded((v) => !v)}
      >
        <td className="px-4 py-2 text-ink-dim">{new Date(entry.timestamp).toLocaleString(locale)}</td>
        <td className="px-4 py-2 font-medium text-ink">{entry.action}</td>
        <td className="px-4 py-2 text-ink-dim">
          {entry.entity}
          {entry.entityId && <span className="text-ink-faint"> #{entry.entityId.slice(0, 8)}</span>}
        </td>
        <td className="px-4 py-2 text-ink-dim">
          {entry.actorType === "master" ? t("auditLog.actorMaster") : t("auditLog.actorTenantUser")}
          {entry.onBehalfOfTenantId && <span className="ml-1 text-xs text-amber-700">({t("auditLog.impersonated")})</span>}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="border-b border-line bg-surface-alt last:border-0">
          <td colSpan={4} className="px-4 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {entry.previousData && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-ink-faint">{t("auditLog.before")}</p>
                  <pre className="overflow-x-auto rounded bg-surface p-2 text-xs text-ink-dim">
                    {JSON.stringify(entry.previousData, null, 2)}
                  </pre>
                </div>
              )}
              {entry.newData && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-ink-faint">{t("auditLog.after")}</p>
                  <pre className="overflow-x-auto rounded bg-surface p-2 text-xs text-ink-dim">{JSON.stringify(entry.newData, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
