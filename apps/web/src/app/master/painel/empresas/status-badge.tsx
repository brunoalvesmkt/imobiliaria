"use client";

import type { TenantStatus } from "@/lib/master-tenants";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export function StatusBadge({ status }: { status: TenantStatus }) {
  const { t } = useI18n();
  const classes: Record<TenantStatus, string> = {
    trial: "bg-surface-muted text-ink-dim",
    active: "bg-brand-50 text-brand-700",
    suspended: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    blocked: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    cancelled: "bg-surface-muted text-ink-faint",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {t(`master.tenants.status.${status}` as DictionaryKey)}
    </span>
  );
}
