"use client";

import { useCrmReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import { PeriodFilter, usePeriodFilter, StatGrid, StatCard, BreakdownTable, ReportError, ExportLink } from "../report-shell";

export default function CrmReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useCrmReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
        <div className="flex flex-wrap gap-3">
          <ExportLink path="/reports/export/contacts" label={t("relatorios.crm.exportContacts")} />
          <ExportLink path="/reports/export/opportunities" label={t("relatorios.crm.exportOpportunities")} />
        </div>
      </div>

      {report.isError && <ReportError />}

      {report.data && (
        <>
          <StatGrid>
            <StatCard label={t("relatorios.crm.contactsCreated")} value={report.data.contactsCreated} />
            <StatCard label={t("relatorios.crm.opportunitiesWon")} value={report.data.opportunitiesWon} />
            <StatCard label={t("relatorios.crm.opportunitiesLost")} value={report.data.opportunitiesLost} />
            <StatCard label={t("relatorios.crm.conversionRate")} value={`${(report.data.conversionRate * 100).toFixed(0)}%`} />
            <StatCard label={t("relatorios.crm.tasksPending")} value={report.data.tasksPending} />
            <StatCard label={t("relatorios.crm.tasksOverdue")} value={report.data.tasksOverdue} />
          </StatGrid>

          <BreakdownTable
            title={t("relatorios.crm.opportunitiesByStage")}
            rows={report.data.opportunitiesByStage.map((s) => ({ label: s.nome, count: s.count }))}
          />
        </>
      )}
    </div>
  );
}
