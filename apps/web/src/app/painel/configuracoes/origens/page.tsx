"use client";

import { useState } from "react";
import {
  useContactOrigins,
  useCreateContactOrigin,
  useUpdateContactOrigin,
  useDeleteContactOrigin,
  type ContactOrigin,
} from "@/lib/crm";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api-client";

export default function ContactOriginsPage() {
  const { t } = useI18n();
  const origins = useContactOrigins();
  const create = useCreateContactOrigin();
  const update = useUpdateContactOrigin();
  const remove = useDeleteContactOrigin();
  const [nome, setNome] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ContactOrigin | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    try {
      await create.mutateAsync(nome.trim());
      setNome("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.origins.errorGeneric"));
    }
  }

  async function onDelete(origin: ContactOrigin, substitutaId?: string) {
    setError(null);
    try {
      await remove.mutateAsync({ id: origin.id, substitutaId });
      setPendingDelete(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !substitutaId) {
        setPendingDelete(origin);
        return;
      }
      setError(err instanceof ApiError ? err.message : t("crm.origins.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("crm.origins.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.origins.subtitle")}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <form onSubmit={onCreate} className="flex items-end gap-3 rounded-lg border border-line bg-surface p-4">
        <div className="flex-1">
          <Field label={t("crm.origins.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <Button type="submit" loading={create.isPending}>
          {t("crm.origins.create")}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {origins.data?.map((origin) => (
          <div key={origin.id} className={`rounded-lg border border-line bg-surface p-3 ${!origin.ativo ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{origin.nome}</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update.mutate({ id: origin.id, ativo: !origin.ativo })}
                  className="text-xs font-medium text-ink-dim hover:underline"
                >
                  {origin.ativo ? t("chatbot.kb.deactivate") : t("chatbot.kb.activate")}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(origin)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  {t("common.remove")}
                </button>
              </div>
            </div>
            {pendingDelete?.id === origin.id && (
              <div className="mt-2 flex items-center gap-2 rounded-md bg-surface-muted p-2">
                <p className="text-xs text-ink-dim">{t("crm.origins.chooseSubstitute")}</p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) onDelete(origin, e.target.value);
                  }}
                  className="rounded border border-line bg-surface px-1.5 py-1 text-xs"
                >
                  <option value="">{t("crm.origins.chooseSubstitute")}</option>
                  {origins.data
                    ?.filter((o) => o.id !== origin.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                </select>
                <button type="button" onClick={() => setPendingDelete(null)} className="text-xs text-ink-faint hover:underline">
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        ))}
        {origins.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.origins.empty")}</p>}
      </div>
    </div>
  );
}
