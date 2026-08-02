"use client";

import { useAutomacaoReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { Button } from "@/components/ui/button";
import { PeriodFilter, usePeriodFilter, StatGrid, StatCard, BreakdownTable, ReportError } from "../report-shell";

export default function AutomacaoReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useAutomacaoReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
        <Button variant="secondary" onClick={() => window.print()}>
          {t("relatorios.exportPdfButton")}
        </Button>
      </div>

      {report.isError && <ReportError />}

      {report.data && (
        <div className="print-area flex flex-col gap-4">
          <h2 className="hidden text-lg font-semibold text-ink print:block">{t("relatorios.tabs.automacao")}</h2>
          <StatGrid>
            <StatCard label={t("relatorios.automacao.deadLetterCount")} value={report.data.deadLetterCount} />
          </StatGrid>

          <BreakdownTable
            title={t("relatorios.automacao.executionsByStatus")}
            rows={report.data.executionsByStatus.map((s) => ({
              label: t(`automation.executions.status.${s.status}` as DictionaryKey),
              count: s.count,
            }))}
          />
        </div>
      )}
    </div>
  );
}
