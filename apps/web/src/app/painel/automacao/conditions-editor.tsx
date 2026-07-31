"use client";

import type { AutomationCondition, ConditionOperator } from "@/lib/automation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const OPERATORS: ConditionOperator[] = ["equals", "contains", "exists", "not_exists"];

export function ConditionsEditor({
  conditions,
  onChange,
}: {
  conditions: AutomationCondition[];
  onChange: (conditions: AutomationCondition[]) => void;
}) {
  const { t } = useI18n();

  function update(index: number, condition: AutomationCondition) {
    onChange(conditions.map((c, i) => (i === index ? condition : c)));
  }
  function remove(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...conditions, { campo: "", operador: "equals" }]);
  }

  const showValue = (operador: ConditionOperator) => operador === "equals" || operador === "contains";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">{t("automation.conditions.title")}</label>
      {conditions.map((condition, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={condition.campo}
            onChange={(e) => update(i, { ...condition, campo: e.target.value })}
            placeholder={t("automation.conditions.field")}
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
          />
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
            <input
              value={condition.valor ?? ""}
              onChange={(e) => update(i, { ...condition, valor: e.target.value })}
              placeholder={t("automation.conditions.value")}
              className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
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
