"use client";

import {
  ID_FIELD_KIND,
  type AutomationCondition,
  type ConditionOperator,
  type DomainEventName,
} from "@/lib/automation";
import { useFlows } from "@/lib/chatbot";
import { useContactOrigins } from "@/lib/crm";
import { useOpportunityReasons } from "@/lib/opportunity-reasons";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { FunnelStagePicker } from "./funnel-stage-picker";

const OPERATORS: ConditionOperator[] = ["equals", "contains", "exists", "not_exists", "greater_than", "less_than"];

export function ConditionsEditor({
  fields,
  conditions,
  onChange,
  trigger,
}: {
  fields: string[];
  conditions: AutomationCondition[];
  onChange: (conditions: AutomationCondition[]) => void;
  trigger?: DomainEventName | "";
}) {
  const { t } = useI18n();

  function update(index: number, condition: AutomationCondition) {
    onChange(conditions.map((c, i) => (i === index ? condition : c)));
  }
  function remove(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...conditions, { campo: fields[0] ?? "", operador: "equals" }]);
  }

  const showValue = (operador: ConditionOperator) =>
    operador === "equals" || operador === "contains" || operador === "greater_than" || operador === "less_than";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">{t("automation.conditions.title")}</label>
      {conditions.map((condition, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={condition.campo}
            onChange={(e) => update(i, { campo: e.target.value, operador: condition.operador })}
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            <option value="" />
            {fields.map((campo) => (
              <option key={campo} value={campo}>
                {t(`automation.conditions.fieldOption.${campo}` as DictionaryKey)}
              </option>
            ))}
          </select>
          <select
            value={condition.operador}
            onChange={(e) => update(i, { ...condition, operador: e.target.value as ConditionOperator })}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {t(`automation.conditions.operator.${op}` as DictionaryKey)}
              </option>
            ))}
          </select>
          {showValue(condition.operador) && (
            <ConditionValueField condition={condition} trigger={trigger} onChange={(valor) => update(i, { ...condition, valor })} />
          )}
          <button type="button" onClick={() => remove(i)} aria-label={t("common.remove")} className="text-xs text-red-600">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-left text-xs font-medium text-brand-700 hover:underline">
        + {t("automation.conditions.add")}
      </button>
    </div>
  );
}

/** Campo "Valor" da condição — vira um seletor por nome quando o campo escolhido é um ID de etapa/fluxo (ver ID_FIELD_KIND), texto livre nos demais casos. */
function ConditionValueField({
  condition,
  trigger,
  onChange,
}: {
  condition: AutomationCondition;
  trigger: DomainEventName | "" | undefined;
  onChange: (valor: string) => void;
}) {
  const { t } = useI18n();
  const kind = ID_FIELD_KIND[condition.campo];

  if (condition.campo === "motivo" && (trigger === "opportunity.won" || trigger === "opportunity.lost")) {
    return <OpportunityReasonValuePicker tipo={trigger === "opportunity.won" ? "won" : "lost"} value={condition.valor ?? ""} onChange={onChange} />;
  }
  if (kind === "flow") {
    return <FlowValuePicker value={condition.valor ?? ""} onChange={onChange} />;
  }
  if (kind === "stage") {
    return <FunnelStagePicker value={condition.valor ?? ""} onChange={onChange} />;
  }
  if (kind === "origin") {
    return <OriginValuePicker value={condition.valor ?? ""} onChange={onChange} />;
  }
  return (
    <input
      value={condition.valor ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("automation.conditions.value")}
      className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
    />
  );
}

function FlowValuePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const flows = useFlows();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
      <option value="" />
      {flows.data?.map((flow) => (
        <option key={flow.id} value={flow.id}>
          {flow.nome}
        </option>
      ))}
    </select>
  );
}

/**
 * Seletor de motivo para as condições de `opportunity.won`/`opportunity.lost` — lista os
 * `OpportunityReason` ativos do tipo certo; como o texto salvo na oportunidade também pode ser o
 * texto livre digitado em "Outro" no fechamento (ver CloseOpportunityModal), o valor sempre fica
 * editável como texto — o select só preenche automaticamente, não trava a condição à lista atual.
 */
function OpportunityReasonValuePicker({ tipo, value, onChange }: { tipo: "won" | "lost"; value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const reasons = useOpportunityReasons(tipo);
  return (
    <div className="flex flex-1 items-center gap-1.5">
      <select
        value={reasons.data?.some((r) => r.nome === value) ? value : ""}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
      >
        <option value="" />
        {reasons.data?.filter((r) => r.ativo).map((r) => (
          <option key={r.id} value={r.nome}>
            {r.nome}
          </option>
        ))}
      </select>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("automation.conditions.value")}
        className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
      />
    </div>
  );
}

/** Seletor da origem configurada em CRM > Configurações > Origens — sempre busca a lista atual do tenant, então origens novas aparecem aqui automaticamente. */
function OriginValuePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const origins = useContactOrigins();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm">
      <option value="" />
      {origins.data?.map((origin) => (
        <option key={origin.id} value={origin.id}>
          {origin.nome}
        </option>
      ))}
    </select>
  );
}

