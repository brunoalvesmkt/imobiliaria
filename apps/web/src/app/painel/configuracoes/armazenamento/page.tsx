"use client";

import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { formatGb, formatLimitGb, storageStatus, STORAGE_STATUS_CLASSES, STORAGE_STATUS_TEXT_CLASSES, useStorageUsage } from "@/lib/storage";

const CATEGORY_LABELS = ["imagensVideos", "audios", "documentos", "outros"] as const;

/** Configurações > Uso e limites — uso total/limite/% + breakdown por categoria. */
export default function StorageSettingsPage() {
  const { t, locale } = useI18n();
  const usage = useStorageUsage();

  if (usage.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (!usage.data) return null;

  const status = storageStatus(usage.data.percentage);
  const widthPercent = usage.data.percentage == null ? 0 : Math.min(100, usage.data.percentage);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("storage.tab.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("storage.tab.subtitle")}</p>
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">{t("storage.usedOfLimit")}</span>
          <span className={`text-sm font-semibold ${STORAGE_STATUS_TEXT_CLASSES[status]}`}>
            {formatGb(usage.data.usedBytes, locale)} / {formatLimitGb(usage.data.limitMb, usage.data.unlimited, locale, t("storage.unlimited"))}
          </span>
        </div>
        {!usage.data.unlimited && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div className={`h-full rounded-full ${STORAGE_STATUS_CLASSES[status]}`} style={{ width: `${widthPercent}%` }} />
          </div>
        )}
        {usage.data.updatedAt && (
          <p className="mt-2 text-xs text-ink-faint">
            {t("storage.lastUpdated")} {new Date(usage.data.updatedAt).toLocaleString(locale)}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("storage.breakdownTitle")}</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {CATEGORY_LABELS.map((category) => (
            <div key={category}>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">{t(`storage.category.${category}` as DictionaryKey)}</dt>
              <dd className="mt-0.5 font-medium text-ink">{formatGb(usage.data!.categories[category], locale)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
