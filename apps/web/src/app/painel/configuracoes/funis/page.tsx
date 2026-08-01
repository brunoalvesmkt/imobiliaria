"use client";

import Link from "next/link";
import { useState } from "react";
import { useFunnels, useDuplicateFunnel, useDeleteFunnel } from "@/lib/crm";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api-client";

/**
 * Reaproveita os mesmos dados/ações de /painel/crm/funil (item 13 do
 * documento: não duplicar a lógica de funis, só expor a gestão aqui também).
 */
export default function FunnelsSettingsPage() {
  const { t } = useI18n();
  const funnels = useFunnels();
  const duplicateFunnel = useDuplicateFunnel();
  const deleteFunnel = useDeleteFunnel();
  const [error, setError] = useState<string | null>(null);

  async function onDuplicate(id: string) {
    setError(null);
    try {
      await duplicateFunnel.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  async function onDelete(id: string) {
    setError(null);
    if (!window.confirm(t("crm.funnel.confirmDelete"))) return;
    try {
      await deleteFunnel.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("crm.funnelsSettings.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.funnelsSettings.subtitle")}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col gap-2">
        {funnels.data?.map((funnel) => (
          <div key={funnel.id} className="flex items-center justify-between rounded-lg border border-line bg-surface p-3">
            <div>
              <p className="text-sm font-medium text-ink">{funnel.nome}</p>
              <p className="text-xs text-ink-faint">
                {funnel.stages.length} {t("crm.funnelsSettings.stagesCount")} · {funnel.status}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/painel/crm/funil" className="text-xs font-medium text-brand-700 hover:underline">
                {t("crm.funnelsSettings.manage")}
              </Link>
              <button
                type="button"
                onClick={() => onDuplicate(funnel.id)}
                className="text-xs font-medium text-ink-dim hover:underline"
              >
                {t("crm.funnel.duplicate")}
              </button>
              <button
                type="button"
                onClick={() => onDelete(funnel.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                {t("common.remove")}
              </button>
            </div>
          </div>
        ))}
        {funnels.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.funnelsSettings.empty")}</p>}
      </div>

      <div>
        <Link
          href="/painel/crm/funil"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-alt"
        >
          {t("crm.funnelsSettings.goToKanban")}
        </Link>
      </div>
    </div>
  );
}
