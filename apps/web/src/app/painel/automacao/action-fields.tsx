"use client";

import { ACTION_TYPES, type ActionType, type AutomationAction } from "@/lib/automation";
import { useFlows } from "@/lib/chatbot";
import { Field } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export function ActionsEditor({
  actions,
  onChange,
}: {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
}) {
  const { t } = useI18n();

  function update(index: number, action: AutomationAction) {
    onChange(actions.map((a, i) => (i === index ? action : a)));
  }
  function remove(index: number) {
    onChange(actions.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...actions, { tipo: "send_message", texto: "" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-ink">{t("automation.actions.title")}</label>
      {actions.map((action, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-md border border-line bg-surface-alt p-3">
          <div className="flex items-center gap-2">
            <select
              value={action.tipo}
              onChange={(e) => update(i, { tipo: e.target.value as ActionType })}
              className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            >
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`automation.actions.type.${type}` as DictionaryKey)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => remove(i)} aria-label={t("common.remove")} className="text-xs text-red-600">
              ×
            </button>
          </div>
          <ActionTypeFields action={action} onChange={(a) => update(i, a)} />
        </div>
      ))}
      <button type="button" onClick={add} className="text-left text-xs font-medium text-brand-700 hover:underline">
        + {t("automation.actions.add")}
      </button>
    </div>
  );
}

function ActionTypeFields({ action, onChange }: { action: AutomationAction; onChange: (a: AutomationAction) => void }) {
  const { t } = useI18n();
  const flows = useFlows();

  switch (action.tipo) {
    case "send_message":
      return (
        <Field
          label={t("automation.actions.field.text")}
          value={action.texto ?? ""}
          onChange={(e) => onChange({ ...action, texto: e.target.value })}
        />
      );
    case "create_task":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field
            label={t("automation.actions.field.title")}
            value={action.titulo ?? ""}
            onChange={(e) => onChange({ ...action, titulo: e.target.value })}
          />
          <Field
            label={t("automation.actions.field.taskType")}
            value={action.tipoTarefa ?? ""}
            onChange={(e) => onChange({ ...action, tipoTarefa: e.target.value })}
          />
          <Field
            label={t("automation.actions.field.hoursToExpire")}
            type="number"
            min={1}
            value={action.horasParaVencer ?? ""}
            onChange={(e) => {
              const { horasParaVencer: _omit, ...rest } = action;
              onChange(e.target.value ? { ...rest, horasParaVencer: Number(e.target.value) } : rest);
            }}
          />
        </div>
      );
    case "apply_tag":
    case "remove_tag":
      return (
        <Field
          label={t("automation.actions.field.tag")}
          value={action.tag ?? ""}
          onChange={(e) => onChange({ ...action, tag: e.target.value })}
        />
      );
    case "update_field":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field
            label={t("automation.actions.field.field")}
            value={action.campo ?? ""}
            onChange={(e) => onChange({ ...action, campo: e.target.value })}
          />
          <Field
            label={t("automation.actions.field.value")}
            value={action.valor ?? ""}
            onChange={(e) => onChange({ ...action, valor: e.target.value })}
          />
        </div>
      );
    case "move_opportunity_stage":
      return (
        <Field
          label={t("automation.actions.field.stageId")}
          value={action.stageId ?? ""}
          onChange={(e) => onChange({ ...action, stageId: e.target.value })}
        />
      );
    case "start_chatbot":
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("automation.actions.field.flow")}</label>
          <select
            value={action.flowId ?? ""}
            onChange={(e) => onChange({ ...action, flowId: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" />
            {flows.data?.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.nome}
              </option>
            ))}
          </select>
        </div>
      );
    case "send_webhook":
      return (
        <Field
          label={t("automation.actions.field.url")}
          value={action.url ?? ""}
          onChange={(e) => onChange({ ...action, url: e.target.value })}
        />
      );
    case "schedule_followup":
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field
            label={t("automation.actions.field.text")}
            value={action.texto ?? ""}
            onChange={(e) => onChange({ ...action, texto: e.target.value })}
          />
          <Field
            label={t("automation.actions.field.delayMinutes")}
            type="number"
            min={1}
            value={action.delayMinutes ?? ""}
            onChange={(e) => {
              const { delayMinutes: _omit, ...rest } = action;
              onChange(e.target.value ? { ...rest, delayMinutes: Number(e.target.value) } : rest);
            }}
          />
        </div>
      );
    default:
      return null;
  }
}
