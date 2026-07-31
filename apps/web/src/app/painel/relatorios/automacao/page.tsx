"use client";

import { useAutomacaoReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { PeriodFilter, usePeriodFilter, StatGrid, StatCard, BreakdownTable, ReportError, ExportLink } from "../report-shell";

export default function AutomacaoReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useAutomacaoReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
        <ExportLink path="/reports/export/automation-executions" label={t("relatorios.automacao.exportExecutions")} />
      </div>

      {report.isError && <ReportError />}

      {report.data && (
        <>
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
        </>
      )}
    </div>
  );
}
