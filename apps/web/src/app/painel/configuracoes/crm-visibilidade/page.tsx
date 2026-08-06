"use client";

import { useEffect, useState } from "react";
import { useCrmVisibilityConfig, useUpdateCrmVisibilityConfig, useResponsavelOptions } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function ConfiguracoesCrmVisibilidadePage() {
  const { t } = useI18n();
  const config = useCrmVisibilityConfig();
  const update = useUpdateCrmVisibilityConfig();
  const responsavelOptions = useResponsavelOptions();
  const [modo, setModo] = useState<"todos" | "especificos">("todos");
  const [usuarioIds, setUsuarioIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (config.data) {
      setModo(config.data.semResponsavelModo);
      setUsuarioIds(new Set(config.data.semResponsavelUsuarioIds));
    }
  }, [config.data]);

  function toggleUsuario(id: string) {
    setUsuarioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ semResponsavelModo: modo, semResponsavelUsuarioIds: Array.from(usuarioIds) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("crm.visibility.configTitle")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.visibility.configSubtitle")}</p>
      </div>

      {config.isLoading && <p className="text-sm text-ink-faint">{t("common.loading")}</p>}

      {config.data && (
        <form onSubmit={onSave} className="flex max-w-md flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          {update.isError && (
            <Alert tone="error">{update.error instanceof ApiError ? update.error.message : t("crm.visibility.configError")}</Alert>
          )}

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="modo" checked={modo === "todos"} onChange={() => setModo("todos")} />
              {t("crm.visibility.modeAll")}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="modo" checked={modo === "especificos"} onChange={() => setModo("especificos")} />
              {t("crm.visibility.modeSpecific")}
            </label>
          </div>

          {modo === "especificos" && (
            <div className="flex flex-col gap-1.5 rounded-md border border-line bg-surface-alt p-3">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("crm.visibility.usersLabel")}</span>
              {responsavelOptions.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.visibility.noUsers")}</p>}
              <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                {responsavelOptions.data?.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={usuarioIds.has(u.id)} onChange={() => toggleUsuario(u.id)} />
                    {u.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-ink-faint">{t("crm.visibility.hint")}</p>
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
