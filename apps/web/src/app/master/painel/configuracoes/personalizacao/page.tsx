"use client";

import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings } from "@/lib/master-settings";
import { Alert } from "@/components/ui/alert";
import { LogoUploadField, LogoSizeField } from "@/components/settings/logo-branding-fields";
import { Section } from "../../configuracoes-empresas/_shared";

export default function MasterOwnSettingsPersonalizacaoPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("branding.title")}>
        <p className="text-xs text-ink-faint">{t("branding.masterSubtitle")}</p>

        <LogoUploadField
          label={t("branding.logoLight")}
          value={settings.data.masterLogoLightUrl}
          onChange={(dataUri) => update.mutate({ masterLogoLightUrl: dataUri })}
        />
        <LogoUploadField
          label={t("branding.logoDark")}
          value={settings.data.masterLogoDarkUrl}
          onChange={(dataUri) => update.mutate({ masterLogoDarkUrl: dataUri })}
        />
        <LogoSizeField
          value={settings.data.masterLogoSizePercent}
          onChange={(value) => update.mutate({ masterLogoSizePercent: value })}
        />
      </Section>
    </div>
  );
}
