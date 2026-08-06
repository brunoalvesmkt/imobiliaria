"use client";

import type { ExecutedStep } from "@/lib/automation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

/** Lista de passos de uma execução (real ou simulada) — mesmo componente usado no histórico detalhado (Execuções) e no resultado do teste simulado. */
export function ExecutionSteps({ passos }: { passos: ExecutedStep[] }) {
  const { t } = useI18n();

  if (passos.length === 0) {
    return <p className="text-xs text-ink-faint">{t("automation.executions.stepsEmpty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-2">
      {passos.map((passo, i) => (
        <li key={i} className="flex items-start gap-2 rounded-md border border-line bg-surface-alt px-3 py-2 text-xs">
          <span
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
              passo.status === "error" ? "bg-red-500" : "bg-brand-500"
            }`}
            aria-hidden
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink">{t(`automation.actions.type.${passo.tipo}` as DictionaryKey)}</span>
              <span className={passo.status === "error" ? "text-red-600" : "text-ink-faint"}>
                {t(`automation.executions.stepStatus.${passo.status}` as DictionaryKey)}
              </span>
            </div>
            {passo.status === "error" ? (
              <span className="text-red-600">{passo.erro}</span>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-ink-dim">
                {JSON.stringify(passo.result, null, 2)}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
