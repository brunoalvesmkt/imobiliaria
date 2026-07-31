"use client";

import { useState } from "react";
import { LOCALE_LABELS, SUPPORTED_LOCALES, useI18n } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t("language.label")}
        aria-label={t("language.label")}
        className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-dim hover:bg-surface-alt"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18M4.5 8h15M4.5 16h15"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <span className="uppercase">{locale}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-line bg-surface py-1 shadow-md">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-surface-alt ${
                  l === locale ? "text-brand-700 font-medium" : "text-ink-dim"
                }`}
              >
                {LOCALE_LABELS[l]}
                {l === locale && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
