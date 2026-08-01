"use client";

import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings, type UpdatePlatformSettingsInput, type PlatformSettings } from "@/lib/master-settings";
import { Alert } from "@/components/ui/alert";
import { Section, Toggle } from "../_shared";

type BoolField = { [K in keyof PlatformSettings]: PlatformSettings[K] extends boolean ? K : never }[keyof PlatformSettings];

export default function MasterSettingsCadastroPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();

  function toggle(field: BoolField, value: boolean) {
    update.mutate({ [field]: value } as UpdatePlatformSettingsInput);
  }

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;
  const s = settings.data;

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

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
    </div>
  );
}
