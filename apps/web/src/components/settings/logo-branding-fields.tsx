"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const MAX_LOGO_BYTES = 200 * 1024;

export function LogoUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (dataUri: string | null) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "image/png") {
      setError(t("branding.errorFormat"));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(t("branding.errorSize"));
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.onerror = () => setError(t("branding.errorGeneric"));
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">{label}</label>
      {value && (
        <div className="flex items-center gap-3 rounded-md border border-line bg-surface-alt p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização de data URI local */}
          <img src={value} alt="" className="h-10 w-auto max-w-[160px] object-contain" />
          <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-ink-faint hover:text-red-600">
            {t("common.remove")}
          </button>
        </div>
      )}
      <input type="file" accept="image/png" onChange={onFileSelected} className="text-sm text-ink-dim" />
      <p className="text-xs text-ink-faint">{t("branding.formatHint")}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function LogoSizeField({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">{t("branding.size")}</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={50}
          max={200}
          step={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <span className="w-12 flex-none text-right text-sm tabular-nums text-ink-dim">{value}%</span>
      </div>
    </div>
  );
}
