"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings, type UpdatePlatformSettingsInput, type PlatformSettings } from "@/lib/master-settings";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Section, Toggle } from "../_shared";

type BoolField = { [K in keyof PlatformSettings]: PlatformSettings[K] extends boolean ? K : never }[keyof PlatformSettings];

export default function MasterSettingsPlanoPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();
  const [buttonText, setButtonText] = useState("");

  useEffect(() => {
    if (settings.data) setButtonText(settings.data.subscribeButtonText);
  }, [settings.data]);

  function toggle(field: BoolField, value: boolean) {
    update.mutate({ [field]: value } as UpdatePlatformSettingsInput);
  }

  function saveButtonText() {
    if (settings.data && buttonText.trim() && buttonText !== settings.data.subscribeButtonText) {
      update.mutate({ subscribeButtonText: buttonText.trim() });
    }
  }

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;
  const s = settings.data;

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("master.settings.planSelection.title")}>
        <Toggle checked={s.planSelectionEnabled} onChange={(v) => toggle("planSelectionEnabled", v)} label={t("master.settings.planSelection.enabled")} />
        <Toggle checked={s.allowMonthly} onChange={(v) => toggle("allowMonthly", v)} label={t("master.settings.planSelection.allowMonthly")} />
        <Toggle checked={s.allowAnnual} onChange={(v) => toggle("allowAnnual", v)} label={t("master.settings.planSelection.allowAnnual")} />
        <Toggle checked={s.showPrices} onChange={(v) => toggle("showPrices", v)} label={t("master.settings.planSelection.showPrices")} />
        <Toggle checked={s.showTrialPeriod} onChange={(v) => toggle("showTrialPeriod", v)} label={t("master.settings.planSelection.showTrialPeriod")} />
        <Toggle
          checked={s.allowPlanChangeBeforeSignup}
          onChange={(v) => toggle("allowPlanChangeBeforeSignup", v)}
          label={t("master.settings.planSelection.allowPlanChange")}
        />
        <div className="flex flex-col gap-1.5 pt-1">
          <Field
            label={t("master.settings.planSelection.buttonText")}
            name="subscribeButtonText"
            value={buttonText}
            onChange={(e) => setButtonText(e.target.value)}
            onBlur={saveButtonText}
            maxLength={60}
          />
        </div>
      </Section>
    </div>
  );
}
