"use client";

import type { AffiliateStatus } from "@/lib/master-affiliates";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export function AffiliateStatusBadge({ status }: { status: AffiliateStatus }) {
  const { t } = useI18n();
  const classes: Record<AffiliateStatus, string> = {
    pending: "bg-surface-muted text-ink-dim",
    approved: "bg-brand-50 text-brand-700",
    rejected: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    active: "bg-brand-50 text-brand-700",
    inactive: "bg-surface-muted text-ink-faint",
    blocked: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {t(`master.affiliates.status.${status}` as DictionaryKey)}
    </span>
  );
}
