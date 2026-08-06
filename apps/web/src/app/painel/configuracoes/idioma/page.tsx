"use client";

import { LOCALE_LABELS, SUPPORTED_LOCALES, useI18n } from "@/lib/i18n";

export default function LanguageSettingsPage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("language.label")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("language.settingsSubtitle")}</p>
      </div>

      <div className="flex max-w-sm flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
              l === locale ? "bg-brand-100 font-medium text-brand-700" : "text-ink-dim hover:bg-surface-alt"
            }`}
          >
            {LOCALE_LABELS[l]}
            {l === locale && <span aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
