"use client";

import { useFinanceiroReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { PeriodFilter, usePeriodFilter, StatGrid, StatCard, BreakdownTable, ReportError, ExportLink } from "../report-shell";

export default function FinanceiroReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useFinanceiroReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
        <ExportLink path="/reports/export/invoices" label={t("relatorios.financeiro.exportInvoices")} />
      </div>

      {report.isError && <ReportError />}

      {report.data && (
        <>
          <StatGrid>
            <StatCard label={t("relatorios.financeiro.mrr")} value={`R$ ${report.data.mrr}`} />
          </StatGrid>

          <BreakdownTable
            title={t("relatorios.financeiro.invoicesByStatus")}
            rows={report.data.invoicesByStatus.map((s) => ({
              label: t(`financeiro.invoiceStatus.${s.status}` as DictionaryKey),
              count: s.count,
              extra: `R$ ${s.total}`,
            }))}
          />
        </>
      )}
    </div>
  );
}
