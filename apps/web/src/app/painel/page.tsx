"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDashboardSummary } from "@/lib/dashboard";
import { ActionsBlock, KpiCard, OperationalGrid, PeriodLabel, PeriodPresetFilter, UpdatedAgo, defaultPeriodFilter } from "./dashboard-widgets";

const CHART_COLOR = "#16a34a";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatPercent01(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function ChartCard({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {empty ? <p className="py-8 text-center text-sm text-ink-faint">{t("dashboard.chart.empty")}</p> : <div className="h-64 w-full">{children}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState(defaultPeriodFilter());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dashboard = useDashboardSummary(filter, true);

  if (dashboard.isLoading) {
    return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="error">{t("dashboard.errorGeneric")}</Alert>
        <Button variant="secondary" onClick={() => dashboard.refetch()} className="w-fit">
          {t("dashboard.retry")}
        </Button>
      </div>
    );
  }

  const data = dashboard.data;
  const comparisonLabel = data.comparacao?.label ? `${t("dashboard.compare.vs")} ${data.comparacao.label}` : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("dashboard.title")}</h1>
          <p className="text-sm text-ink-dim">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {dashboard.dataUpdatedAt > 0 && <UpdatedAgo dataUpdatedAt={dashboard.dataUpdatedAt} />}
          <Button variant="secondary" onClick={() => dashboard.refetch()}>
            {t("dashboard.refresh")}
          </Button>
        </div>
      </div>

      {data.modulosAtivos.length === 0 && <Alert tone="info">{t("dashboard.noModules")}</Alert>}

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
        <PeriodPresetFilter filter={filter} onChange={setFilter} />
        <PeriodLabel label={data.periodo.label} />
      </div>

      {(data.crm || data.atendimento) && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink">{t("dashboard.visaoGeral.title")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.crm && (
              <>
                <KpiCard
                  label={t("dashboard.crm.novosContatos")}
                  value={data.crm.atual.contactsCreated}
                  delta={data.crm.deltas.contactsCreated}
                  comparisonLabel={comparisonLabel}
                  href={`/painel/crm/contatos?desde=${data.periodo.from}&ate=${data.periodo.to}`}
                  tooltip={t("dashboard.crm.novosContatos")}
                />
                <KpiCard
                  label={t("dashboard.crm.valorGanho")}
                  value={formatCurrency(data.crm.atual.opportunitiesWonValue)}
                  delta={data.crm.deltas.opportunitiesWonValue}
                  comparisonLabel={comparisonLabel}
                  href="/painel/crm/funil"
                  tooltip={t("dashboard.crm.valorGanho")}
                />
              </>
            )}
            {data.atendimento && (
              <KpiCard
                label={t("dashboard.atendimento.totalConversas")}
                value={data.atendimento.atual.conversationsByStatus.reduce((sum, g) => sum + g.count, 0)}
                delta={data.atendimento.deltas.total}
                comparisonLabel={comparisonLabel}
                href="/painel/atendimento/inbox"
                tooltip={t("dashboard.atendimento.totalConversas")}
              />
            )}
            <KpiCard
              label={t("dashboard.operacional.conversasAguardando")}
              value={data.operacional.conversasAguardando ?? 0}
              href="/painel/atendimento/inbox?status=open"
              tooltip={t("dashboard.operacional.conversasAguardando.tooltip")}
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("dashboard.acoes.title")}</h2>
        <ActionsBlock actions={data.acoes} dismissed={dismissed} onDismiss={(id) => setDismissed((prev) => new Set(prev).add(id))} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">{t("dashboard.operacional.title")}</h2>
        <OperationalGrid operacional={data.operacional} />
      </section>

      {data.crm && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">{t("dashboard.crm.title")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label={t("dashboard.crm.novosContatos")}
              value={data.crm.atual.contactsCreated}
              delta={data.crm.deltas.contactsCreated}
              comparisonLabel={comparisonLabel}
              href={`/painel/crm/contatos?desde=${data.periodo.from}&ate=${data.periodo.to}`}
              tooltip={t("dashboard.tooltip.novosContatos")}
            />
            <KpiCard
              label={t("dashboard.crm.oportunidadesGanhas")}
              value={data.crm.atual.opportunitiesWon}
              delta={data.crm.deltas.opportunitiesWon}
              comparisonLabel={comparisonLabel}
              href="/painel/crm/funil"
              tooltip={t("dashboard.tooltip.oportunidadesGanhas")}
            />
            <KpiCard
              label={t("dashboard.crm.valorGanho")}
              value={formatCurrency(data.crm.atual.opportunitiesWonValue)}
              delta={data.crm.deltas.opportunitiesWonValue}
              comparisonLabel={comparisonLabel}
              href="/painel/crm/funil"
              tooltip={t("dashboard.tooltip.valorGanho")}
            />
            <KpiCard
              label={t("dashboard.crm.taxaConversao")}
              value={formatPercent01(data.crm.atual.conversionRate)}
              delta={data.crm.deltas.conversionRate}
              comparisonLabel={comparisonLabel}
              tooltip={t("dashboard.tooltip.taxaConversao")}
            />
          </div>

          <ChartCard title={t("dashboard.crm.porEtapa")} empty={data.crm.atual.opportunitiesByStage.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.crm.atual.opportunitiesByStage} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      )}

      {data.atendimento && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink">{t("dashboard.atendimento.title")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              label={t("dashboard.atendimento.totalConversas")}
              value={data.atendimento.atual.conversationsByStatus.reduce((sum, g) => sum + g.count, 0)}
              delta={data.atendimento.deltas.total}
              comparisonLabel={comparisonLabel}
              href="/painel/atendimento/inbox"
              tooltip={t("dashboard.tooltip.totalConversas")}
            />
            <KpiCard
              label={t("dashboard.atendimento.fechadas")}
              value={data.atendimento.atual.conversationsByStatus.find((g) => g.status === "closed")?.count ?? 0}
              delta={data.atendimento.deltas.fechadas}
              comparisonLabel={comparisonLabel}
              href="/painel/atendimento/inbox?status=closed"
              tooltip={t("dashboard.tooltip.fechadas")}
            />
          </div>

          <ChartCard title={t("dashboard.atendimento.porStatus")} empty={data.atendimento.atual.conversationsByStatus.length === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.atendimento.atual.conversationsByStatus.map((g) => ({ ...g, label: t(`dashboard.atendimento.status.${g.status}` as DictionaryKey) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>
      )}
    </div>
  );
}
