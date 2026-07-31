"use client";

import { useEffect, useState } from "react";
import { useQualityConfig, useUpdateQualityConfig, type QualityCriterionConfig } from "@/lib/quality";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function ConfiguracoesQualidadePage() {
  const { t } = useI18n();
  const config = useQualityConfig();
  const update = useUpdateQualityConfig();
  const [criterios, setCriterios] = useState<QualityCriterionConfig[]>([]);
  const [notaMinima, setNotaMinima] = useState("6");

  useEffect(() => {
    if (config.data) {
      setCriterios(config.data.criterios);
      setNotaMinima(String(config.data.notaMinima));
    }
  }, [config.data]);

  function updateCriterio(index: number, patch: Partial<QualityCriterionConfig>) {
    setCriterios((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCriterio(index: number) {
    setCriterios((prev) => prev.filter((_, i) => i !== index));
  }

  function addCriterio() {
    setCriterios((prev) => [...prev, { nome: "", peso: 1, obrigatorio: false }]);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ criterios, notaMinima: Number(notaMinima) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("quality.configTitle")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("quality.configSubtitle")}</p>
      </div>

      {config.isLoading && <p className="text-sm text-ink-faint">{t("common.loading")}</p>}
      {config.isError && <Alert tone="info">{t("quality.configNotEnabled")}</Alert>}

      {config.data && (
        <form onSubmit={onSave} className="flex max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface p-4">
          {update.isError && (
            <Alert tone="error">{update.error instanceof ApiError ? update.error.message : t("quality.configError")}</Alert>
          )}

          <div className="flex flex-col gap-2">
            {criterios.map((criterio, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={criterio.nome}
                  onChange={(e) => updateCriterio(i, { nome: e.target.value })}
                  placeholder={t("quality.configCriterionName")}
                  className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={criterio.peso}
                  onChange={(e) => updateCriterio(i, { peso: Number(e.target.value) })}
                  title={t("quality.configWeight")}
                  className="w-16 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
                />
                <label className="flex items-center gap-1 text-xs text-ink-dim">
                  <input
                    type="checkbox"
                    checked={criterio.obrigatorio}
                    onChange={(e) => updateCriterio(i, { obrigatorio: e.target.checked })}
                  />
                  {t("quality.configMandatory")}
                </label>
                <button type="button" onClick={() => removeCriterio(i)} aria-label={t("common.remove")} className="text-xs text-red-600">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={addCriterio} className="mt-1 text-left text-xs font-medium text-brand-700 hover:underline">
              + {t("quality.configAddCriterion")}
            </button>
          </div>

          <Field
            label={t("quality.configMinScore")}
            type="number"
            min={0}
            max={10}
            value={notaMinima}
            onChange={(e) => setNotaMinima(e.target.value)}
          />

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
