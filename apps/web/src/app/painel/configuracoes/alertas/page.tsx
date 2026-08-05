"use client";

import { useEffect, useState } from "react";
import { useAlertConfig, useUpdateAlertConfig } from "@/lib/dashboard";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function ConfiguracoesAlertasPage() {
  const { t } = useI18n();
  const config = useAlertConfig(true);
  const update = useUpdateAlertConfig();
  const [queueWaitMinutes, setQueueWaitMinutes] = useState("10");
  const [opportunityStagnantDays, setOpportunityStagnantDays] = useState("5");
  const [proposalNoResponseDays, setProposalNoResponseDays] = useState("3");
  const [taskOverdueEnabled, setTaskOverdueEnabled] = useState(true);

  useEffect(() => {
    if (config.data) {
      setQueueWaitMinutes(String(config.data.queueWaitMinutes));
      setOpportunityStagnantDays(String(config.data.opportunityStagnantDays));
      setProposalNoResponseDays(String(config.data.proposalNoResponseDays));
      setTaskOverdueEnabled(config.data.taskOverdueEnabled);
    }
  }, [config.data]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      queueWaitMinutes: Number(queueWaitMinutes),
      opportunityStagnantDays: Number(opportunityStagnantDays),
      proposalNoResponseDays: Number(proposalNoResponseDays),
      taskOverdueEnabled,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("dashboard.alertConfig.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("dashboard.alertConfig.subtitle")}</p>
      </div>

      {config.isLoading && <p className="text-sm text-ink-faint">{t("common.loading")}</p>}

      {config.data && (
        <form onSubmit={onSave} className="flex max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          {update.isError && (
            <Alert tone="error">{update.error instanceof ApiError ? update.error.message : t("dashboard.alertConfig.errorGeneric")}</Alert>
          )}
          <Field
            label={t("dashboard.alertConfig.queueWaitMinutes")}
            type="number"
            min={1}
            value={queueWaitMinutes}
            onChange={(e) => setQueueWaitMinutes(e.target.value)}
          />
          <Field
            label={t("dashboard.alertConfig.opportunityStagnantDays")}
            type="number"
            min={1}
            value={opportunityStagnantDays}
            onChange={(e) => setOpportunityStagnantDays(e.target.value)}
          />
          <Field
            label={t("dashboard.alertConfig.proposalNoResponseDays")}
            type="number"
            min={1}
            value={proposalNoResponseDays}
            onChange={(e) => setProposalNoResponseDays(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={taskOverdueEnabled} onChange={(e) => setTaskOverdueEnabled(e.target.checked)} />
            {t("dashboard.alertConfig.taskOverdueEnabled")}
          </label>
          <div>
            <Button type="submit" loading={update.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
