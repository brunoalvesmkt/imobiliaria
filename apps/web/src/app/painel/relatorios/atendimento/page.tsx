"use client";

import { useAtendimentoReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { PeriodFilter, usePeriodFilter, BreakdownTable, ReportError, ExportLink } from "../report-shell";

export default function AtendimentoReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useAtendimentoReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
        <ExportLink path="/reports/export/conversations" label={t("relatorios.atendimento.exportConversations")} />
      </div>

      {report.isError && <ReportError />}

      {report.data && (
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
      )}
    </div>
  );
}
