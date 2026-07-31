"use client";

import { useDashboard } from "@/lib/reports";
import { Alert } from "@/components/ui/alert";
import { SectionCard, StatCard } from "@/components/ui/stat-card";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export default function DashboardPage() {
  const { t } = useI18n();
  const dashboard = useDashboard(true);

  if (dashboard.isLoading) {
    return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  }

  if (dashboard.isError || !dashboard.data) {
    return <Alert tone="error">{t("dashboard.errorGeneric")}</Alert>;
  }

  const data = dashboard.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("dashboard.title")}</h1>
        <p className="text-sm text-ink-dim">{t("dashboard.subtitle")}</p>
      </div>

      {data.modulosAtivos.length === 0 && <Alert tone="info">{t("dashboard.noModules")}</Alert>}

      <SectionCard title={t("dashboard.financeiro.title")}>
        <StatCard label={t("dashboard.financeiro.subscriptionStatus")} value={statusLabel(data.financeiro.subscriptionStatus, t)} />
        <StatCard label={t("dashboard.financeiro.plan")} value={data.financeiro.plano ?? t("dashboard.financeiro.noPlan")} />
        <StatCard label={t("dashboard.financeiro.overdueInvoices")} value={data.financeiro.overdueInvoicesCount} />
      </SectionCard>

      {data.crm && (
        <SectionCard title={t("dashboard.crm.title")}>
          <StatCard label={t("dashboard.crm.totalContacts")} value={data.crm.totalContacts} />
          <StatCard label={t("dashboard.crm.openOpportunities")} value={data.crm.openOpportunities} />
          <StatCard label={t("dashboard.crm.wonThisMonth")} value={data.crm.wonOpportunitiesThisMonth} />
          <StatCard label={t("dashboard.crm.pendingTasks")} value={data.crm.pendingTasks} />
        </SectionCard>
      )}

      {data.whatsapp && (
        <SectionCard title={t("dashboard.whatsapp.title")}>
          <StatCard label={t("dashboard.whatsapp.connectedNumbers")} value={data.whatsapp.connectedNumbers} />
          <StatCard label={t("dashboard.whatsapp.messagesLast7Days")} value={data.whatsapp.messagesLast7Days} />
        </SectionCard>
      )}

      {data.atendimento && (
        <SectionCard title={t("dashboard.atendimento.title")}>
          <StatCard label={t("dashboard.atendimento.openConversations")} value={data.atendimento.openConversations} />
          <StatCard label={t("dashboard.atendimento.waitingQueue")} value={data.atendimento.conversationsWaitingQueue} />
        </SectionCard>
      )}

      {data.chatbot && (
        <SectionCard title={t("dashboard.chatbot.title")}>
          <StatCard label={t("dashboard.chatbot.activeFlows")} value={data.chatbot.activeFlows} />
          <StatCard label={t("dashboard.chatbot.executionsLast7Days")} value={data.chatbot.executionsLast7Days} />
        </SectionCard>
      )}

      {data.automacao && (
        <SectionCard title={t("dashboard.automacao.title")}>
          <StatCard label={t("dashboard.automacao.activeAutomations")} value={data.automacao.activeAutomations} />
          <StatCard label={t("dashboard.automacao.executionsLast7Days")} value={data.automacao.executionsLast7Days} />
          <StatCard label={t("dashboard.automacao.deadLetter")} value={data.automacao.deadLetterCount} />
        </SectionCard>
      )}
    </div>
  );
}

function statusLabel(status: string, t: (key: DictionaryKey) => string): string {
  const key = `dashboard.financeiro.status.${status}` as DictionaryKey;
  const translated = t(key);
  return translated === key ? status : translated;
}
