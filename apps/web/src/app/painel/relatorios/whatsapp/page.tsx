"use client";

import { useWhatsappReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { PeriodFilter, usePeriodFilter, StatGrid, StatCard, BreakdownTable, ReportError, ExportLink } from "../report-shell";

export default function WhatsappReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useWhatsappReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
        <ExportLink path="/reports/export/messages" label={t("relatorios.whatsapp.exportMessages")} />
      </div>

      {report.isError && <ReportError />}

      {report.data && (
        <>
          <StatGrid>
            <StatCard label={t("relatorios.whatsapp.messagesSent")} value={report.data.messagesSent} />
            <StatCard label={t("relatorios.whatsapp.messagesReceived")} value={report.data.messagesReceived} />
            <StatCard label={t("relatorios.whatsapp.messagesFailed")} value={report.data.messagesFailed} />
          </StatGrid>

          <BreakdownTable
            title={t("relatorios.whatsapp.numbersByStatus")}
            rows={report.data.numbersByStatus.map((s) => ({
              label: t(`whatsapp.status.${s.status}` as DictionaryKey),
              count: s.count,
            }))}
          />
        </>
      )}
    </div>
  );
}
