"use client";

import { useAtendimentoReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { Button } from "@/components/ui/button";
import { PeriodFilter, usePeriodFilter, BreakdownTable, ReportError } from "../report-shell";

export default function AtendimentoReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useAtendimentoReport(applied);

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
          <h2 className="hidden text-lg font-semibold text-ink print:block">{t("relatorios.tabs.atendimento")}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BreakdownTable
              title={t("relatorios.atendimento.conversationsByStatus")}
              rows={report.data.conversationsByStatus.map((s) => ({
                label: t(`atendimento.inbox.status.${s.status}` as DictionaryKey),
                count: s.count,
              }))}
            />
            <BreakdownTable
              title={t("relatorios.atendimento.conversationsByQueue")}
              rows={report.data.conversationsByQueue.map((q) => ({
                label: q.nome || t("relatorios.noQueue"),
                count: q.count,
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
