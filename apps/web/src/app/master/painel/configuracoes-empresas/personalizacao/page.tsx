"use client";

import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings } from "@/lib/master-settings";
import { Alert } from "@/components/ui/alert";
import { LogoUploadField, LogoSizeField } from "@/components/settings/logo-branding-fields";
import { Section } from "../_shared";

export default function MasterSettingsPersonalizacaoPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("branding.title")}>
        <p className="text-xs text-ink-faint">{t("branding.tenantSubtitle")}</p>

        <LogoUploadField
          label={t("branding.logoLight")}
          value={settings.data.tenantLogoLightUrl}
          onChange={(dataUri) => update.mutate({ tenantLogoLightUrl: dataUri })}
        />
        <LogoUploadField
          label={t("branding.logoDark")}
          value={settings.data.tenantLogoDarkUrl}
          onChange={(dataUri) => update.mutate({ tenantLogoDarkUrl: dataUri })}
        />
        <LogoSizeField
          value={settings.data.tenantLogoSizePercent}
          onChange={(value) => update.mutate({ tenantLogoSizePercent: value })}
        />
      </Section>
    </div>
  );
}
