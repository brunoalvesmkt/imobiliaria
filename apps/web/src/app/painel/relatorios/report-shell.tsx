"use client";

import { useState } from "react";
import type { DateRange } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { apiUrl } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function usePeriodFilter() {
  const [draft, setDraft] = useState<DateRange>({});
  const [applied, setApplied] = useState<DateRange>({});
  return { draft, setDraft, applied, apply: () => setApplied(draft) };
}

export function PeriodFilter({ draft, setDraft, onApply }: { draft: DateRange; setDraft: (r: DateRange) => void; onApply: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-dim">{t("relatorios.period.from")}</label>
        <input
          type="date"
          value={toDateInputValue(draft.from)}
          onChange={(e) => {
            const { from: _omit, ...rest } = draft;
            setDraft(e.target.value ? { ...rest, from: new Date(e.target.value).toISOString() } : rest);
          }}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-dim">{t("relatorios.period.to")}</label>
        <input
          type="date"
          value={toDateInputValue(draft.to)}
          onChange={(e) => {
            const { to: _omit, ...rest } = draft;
            setDraft(e.target.value ? { ...rest, to: new Date(e.target.value).toISOString() } : rest);
          }}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        />
      </div>
      <Button variant="secondary" onClick={onApply}>
        {t("relatorios.period.apply")}
      </Button>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-faint">{label}</p>
    </div>
  );
}

export function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number; extra?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-4 py-2 text-ink-dim">{row.label}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums text-ink">{row.count}</td>
                {row.extra !== undefined && <td className="px-4 py-2 text-right tabular-nums text-ink-dim">{row.extra}</td>}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-ink-faint">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Um export vira três links — CSV (já existia), XLSX (Fase 33) e PDF (Fase
 * 36, ver DEVELOPMENT_PLAN.md) — mesma rota base, sufixo por formato.
 */
export function ExportLink({ path, label }: { path: string; label: string }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="text-ink-faint">{label}:</span>
      <a href={apiUrl(path)} className="text-brand-700 hover:underline">
        {t("relatorios.exportCsv")}
      </a>
      <span className="text-ink-faint">·</span>
      <a href={apiUrl(`${path}.xlsx`)} className="text-brand-700 hover:underline">
        {t("relatorios.exportXlsx")}
      </a>
      <span className="text-ink-faint">·</span>
      <a href={apiUrl(`${path}.pdf`)} className="text-brand-700 hover:underline">
        {t("relatorios.exportPdf")}
      </a>
    </span>
  );
}

export function ReportError() {
  const { t } = useI18n();
  return <Alert tone="error">{t("relatorios.errorGeneric")}</Alert>;
}

export function reportStatusLabel(t: (key: DictionaryKey) => string, namespace: string, status: string): string {
  const key = `${namespace}.status.${status}` as DictionaryKey;
  const label = t(key);
  return label === key ? status : label;
}
