"use client";

import { useEffect, useState } from "react";
import { useLeadScoreConfig, useUpdateLeadScoreConfig } from "@/lib/crm";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function ConfiguracoesLeadScorePage() {
  const { t } = useI18n();
  const config = useLeadScoreConfig();
  const update = useUpdateLeadScoreConfig();
  const [morno, setMorno] = useState("40");
  const [quente, setQuente] = useState("70");

  useEffect(() => {
    if (config.data) {
      setMorno(String(config.data.morno));
      setQuente(String(config.data.quente));
    }
  }, [config.data]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ morno: Number(morno), quente: Number(quente) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("crm.leadScore.configTitle")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.leadScore.configSubtitle")}</p>
      </div>

      {config.isLoading && <p className="text-sm text-ink-faint">{t("common.loading")}</p>}

      {config.data && (
        <form onSubmit={onSave} className="flex max-w-sm flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          {update.isError && (
            <Alert tone="error">{update.error instanceof ApiError ? update.error.message : t("crm.leadScore.configError")}</Alert>
          )}
          <Field
            label={t("crm.leadScore.thresholdMorno")}
            type="number"
            min={1}
            max={99}
            value={morno}
            onChange={(e) => setMorno(e.target.value)}
          />
          <Field
            label={t("crm.leadScore.thresholdQuente")}
            type="number"
            min={1}
            max={100}
            value={quente}
            onChange={(e) => setQuente(e.target.value)}
          />
          <p className="text-xs text-ink-faint">{t("crm.leadScore.thresholdHint")}</p>
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
