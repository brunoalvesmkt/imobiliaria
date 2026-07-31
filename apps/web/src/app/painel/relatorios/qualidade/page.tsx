"use client";

import { useQualidadeReport } from "@/lib/reports";
import { useI18n } from "@/lib/i18n";
import { PeriodFilter, usePeriodFilter, StatGrid, StatCard, BreakdownTable, ReportError } from "../report-shell";

export default function QualidadeReportPage() {
  const { t } = useI18n();
  const { draft, setDraft, applied, apply } = usePeriodFilter();
  const report = useQualidadeReport(applied);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter draft={draft} setDraft={setDraft} onApply={apply} />
      </div>

      {report.isError && <ReportError />}

      {report.data && (
        <>
          <StatGrid>
            <StatCard label={t("relatorios.qualidade.totalAvaliacoes")} value={report.data.totalAvaliacoes} />
            <StatCard label={t("relatorios.qualidade.notaMedia")} value={report.data.notaMedia} />
          </StatGrid>

          <BreakdownTable
            title={t("relatorios.qualidade.mediaPorAtendente")}
            rows={report.data.mediaPorAtendente.map((a) => ({ label: a.nome, count: a.avaliacoes, extra: String(a.media) }))}
          />

          <BreakdownTable
            title={t("relatorios.qualidade.evolucaoMensal")}
            rows={report.data.evolucaoMensal.map((m) => ({ label: m.mes, count: m.avaliacoes, extra: String(m.media) }))}
          />

          <RecurrentList title={t("relatorios.qualidade.pontosFortesRecorrentes")} items={report.data.pontosFortesRecorrentes} />
          <RecurrentList title={t("relatorios.qualidade.pontosFracosRecorrentes")} items={report.data.pontosFracosRecorrentes} />
        </>
      )}
    </div>
  );
}

function RecurrentList({ title, items }: { title: string; items: { texto: string; count: number }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="rounded-lg border border-line bg-surface p-3">
        {items.length === 0 ? (
          <p className="text-sm text-ink-faint">—</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink-dim">{item.texto}</span>
                <span className="font-medium tabular-nums text-ink">{item.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
