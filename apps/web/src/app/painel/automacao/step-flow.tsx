"use client";

import {
  TRIGGER_PARAM_KEY,
  type ActionType,
  type AutomationAction,
  type AutomationCatalog,
  type AutomationCategory,
  type AutomationCondition,
  type DomainEventName,
} from "@/lib/automation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { ConditionsEditor } from "./conditions-editor";
import { ActionsEditor } from "./action-fields";

/**
 * Builder visual em etapas (Fase E) — reorganiza o mesmo modelo de dados de sempre (1 gatilho +
 * lista de condições avaliadas em E + lista de ações em sequência) em cards conectados "Quando" →
 * "Se" → "Faça", em vez do bloco de formulário plano que existia antes. Reaproveita `ConditionsEditor`
 * e `ActionsEditor` sem alteração de props — só muda a apresentação, não o formato salvo no backend.
 * Usado tanto na criação (`page.tsx`) quanto na edição (`[id]/page.tsx`), eliminando a duplicação
 * de JSX que existia entre as duas telas.
 */
export function StepFlow({
  catalog,
  tipoAutomacao,
  gatilhoTipo,
  onGatilhoTipoChange,
  gatilhoParametroValor,
  onGatilhoParametroValorChange,
  condicoes,
  onCondicoesChange,
  acoes,
  onAcoesChange,
}: {
  catalog: AutomationCatalog | undefined;
  tipoAutomacao: AutomationCategory | "";
  gatilhoTipo: DomainEventName | "";
  onGatilhoTipoChange: (gatilhoTipo: DomainEventName) => void;
  gatilhoParametroValor: string;
  onGatilhoParametroValorChange: (valor: string) => void;
  condicoes: AutomationCondition[];
  onCondicoesChange: (condicoes: AutomationCondition[]) => void;
  acoes: AutomationAction[];
  onAcoesChange: (acoes: AutomationAction[]) => void;
}) {
  const { t } = useI18n();

  const availableTriggers = (catalog?.triggers ?? []).filter(
    (trig) => trig.available && (!tipoAutomacao || trig.category === tipoAutomacao),
  );
  const availableActions = (catalog?.actions ?? []).filter((a) => a.available).map((a) => a.tipo) as ActionType[];
  const fields = catalog?.triggers.find((trig) => trig.event === gatilhoTipo)?.fields ?? [];
  const paramKey = gatilhoTipo ? TRIGGER_PARAM_KEY[gatilhoTipo] : undefined;

  return (
    <div className="flex flex-col">
      <StepCard number={1} label={t("automation.step.when")}>
        <select
          value={gatilhoTipo}
          onChange={(e) => onGatilhoTipoChange(e.target.value as DomainEventName)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          {!gatilhoTipo && <option value="" />}
          {availableTriggers.map((trig) => (
            <option key={trig.event} value={trig.event}>
              {t(`automation.trigger.${trig.event}` as DictionaryKey)}
            </option>
          ))}
        </select>
        {paramKey && (
          <div className="mt-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-ink">{t(`automation.trigger.param.${paramKey}` as DictionaryKey)}</label>
            <input
              type="number"
              min={1}
              required
              value={gatilhoParametroValor}
              onChange={(e) => onGatilhoParametroValorChange(e.target.value)}
              className="max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
            <p className="text-xs text-ink-faint">{t("automation.trigger.dataHint")}</p>
          </div>
        )}
      </StepCard>

      <StepConnector />

      <StepCard number={2} label={t("automation.step.if")}>
        {fields.length === 0 && condicoes.length === 0 ? (
          <p className="text-xs text-ink-faint">{t("automation.step.noConditions")}</p>
        ) : (
          <ConditionsEditor fields={fields} conditions={condicoes} onChange={onCondicoesChange} trigger={gatilhoTipo} />
        )}
      </StepCard>

      <StepConnector />

      <StepCard number={3} label={t("automation.step.do")}>
        <ActionsEditor actionTypes={availableActions} actions={acoes} onChange={onAcoesChange} />
      </StepCard>
    </div>
  );
}

function StepCard({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          {number}
        </span>
      </div>
      <div className="flex-1 rounded-lg border border-line bg-surface p-3 pb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
        {children}
      </div>
    </div>
  );
}

function StepConnector() {
  return (
    <div className="flex">
      <div className="flex w-7 shrink-0 justify-center">
        <div className="h-4 w-px bg-line" />
      </div>
    </div>
  );
}
