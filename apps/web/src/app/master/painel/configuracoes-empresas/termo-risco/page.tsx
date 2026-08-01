"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings } from "@/lib/master-settings";
import { Alert } from "@/components/ui/alert";
import { Section } from "../_shared";

export default function MasterSettingsTermoRiscoPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();
  const [riskTermText, setRiskTermText] = useState("");

  useEffect(() => {
    if (settings.data) setRiskTermText(settings.data.riskTermText);
  }, [settings.data]);

  function publishRiskTerm() {
    if (!settings.data || !riskTermText.trim()) return;
    const nextVersion = String((Number(settings.data.riskTermVersion) || 0) + 1);
    update.mutate({ riskTermText: riskTermText.trim(), riskTermVersion: nextVersion });
  }

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;
  const s = settings.data;

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("master.settings.riskTerm.title")}>
        <p className="text-xs text-ink-faint">{t("master.settings.riskTerm.subtitle")}</p>
        <p className="text-xs text-ink-faint">
          {t("master.settings.riskTerm.currentVersion")}: {s.riskTermVersion}
        </p>
        <textarea
          value={riskTermText}
          onChange={(e) => setRiskTermText(e.target.value)}
          rows={4}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
        <div>
          <button
            type="button"
            onClick={publishRiskTerm}
            disabled={!riskTermText.trim() || riskTermText === s.riskTermText}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {t("master.settings.riskTerm.publish")}
          </button>
        </div>
      </Section>
    </div>
  );
}
