"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings, type PlatformSettings, type UpdatePlatformSettingsInput } from "@/lib/master-settings";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type BoolField = { [K in keyof PlatformSettings]: PlatformSettings[K] extends boolean ? K : never }[keyof PlatformSettings];

export default function MasterConfiguracoesEmpresasPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();
  const [buttonText, setButtonText] = useState("");
  const [riskTermText, setRiskTermText] = useState("");

  useEffect(() => {
    if (settings.data) setButtonText(settings.data.subscribeButtonText);
  }, [settings.data]);

  useEffect(() => {
    if (settings.data) setRiskTermText(settings.data.riskTermText);
  }, [settings.data]);

  function publishRiskTerm() {
    if (!settings.data || !riskTermText.trim()) return;
    const nextVersion = String((Number(settings.data.riskTermVersion) || 0) + 1);
    update.mutate({ riskTermText: riskTermText.trim(), riskTermVersion: nextVersion });
  }

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
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("master.settings.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("master.settings.subtitle")}</p>
      </div>

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

      <Section title={t("master.settings.emailConfirmation.title")}>
        <Toggle
          checked={s.emailConfirmRepeatEnabled}
          onChange={(v) => toggle("emailConfirmRepeatEnabled", v)}
          label={t("master.settings.emailConfirmation.repeat")}
        />
        <Toggle
          checked={s.emailConfirmCodeEnabled}
          onChange={(v) => toggle("emailConfirmCodeEnabled", v)}
          label={t("master.settings.emailConfirmation.code")}
        />
      </Section>

      <Section title={t("master.settings.tenantEditing.title")}>
        <Toggle checked={s.tenantCanEditProfile} onChange={(v) => toggle("tenantCanEditProfile", v)} label={t("master.settings.tenantEditing.allowEdit")} />
        <Toggle
          checked={s.requireCodeOnEmailChange}
          onChange={(v) => toggle("requireCodeOnEmailChange", v)}
          label={t("master.settings.tenantEditing.requireCodeOnEmailChange")}
        />
      </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-dim">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
