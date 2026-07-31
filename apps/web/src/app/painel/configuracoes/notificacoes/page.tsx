"use client";

import { useEffect, useState } from "react";
import { useNotificationWhatsappSettings, useUpdateNotificationWhatsappSettings } from "@/lib/notifications";
import { useNumbers } from "@/lib/whatsapp";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";

export default function NotificationSettingsPage() {
  const { t } = useI18n();
  const settings = useNotificationWhatsappSettings();
  const numbers = useNumbers();
  const update = useUpdateNotificationWhatsappSettings();
  const [whatsAppNumberId, setWhatsAppNumberId] = useState("");
  const [destinoNumero, setDestinoNumero] = useState("");

  useEffect(() => {
    if (settings.data) {
      setWhatsAppNumberId(settings.data.whatsAppNumberId ?? "");
      setDestinoNumero(settings.data.destinoNumero ?? "");
    }
  }, [settings.data]);

  const connectedNumbers = numbers.data?.filter((n) => n.status === "connected") ?? [];

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      whatsAppNumberId: whatsAppNumberId || null,
      destinoNumero: destinoNumero || null,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("notifications.whatsappSettings.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("notifications.whatsappSettings.subtitle")}</p>
      </div>

      <form onSubmit={onSave} className="flex max-w-lg flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        {update.isError && <Alert tone="error">{t("notifications.whatsappSettings.error")}</Alert>}
        {connectedNumbers.length === 0 && <Alert tone="info">{t("notifications.whatsappSettings.noNumbers")}</Alert>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("notifications.whatsappSettings.sourceNumber")}</label>
          <select
            value={whatsAppNumberId}
            onChange={(e) => setWhatsAppNumberId(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("notifications.whatsappSettings.none")}</option>
            {connectedNumbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.numero}
              </option>
            ))}
          </select>
        </div>

        <Field
          label={t("notifications.whatsappSettings.destinationNumber")}
          value={destinoNumero}
          onChange={(e) => setDestinoNumero(e.target.value)}
          placeholder="5511999998888"
        />

        <div>
          <Button type="submit" loading={update.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
