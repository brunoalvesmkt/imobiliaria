"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DEFAULT_DOMAIN_EVENT,
  DOMAIN_EVENTS,
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  type Automation,
  type AutomationAction,
  type AutomationCondition,
  type DomainEventName,
} from "@/lib/automation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { ConditionsEditor } from "./conditions-editor";
import { ActionsEditor } from "./action-fields";

export default function AutomationPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const automations = useAutomations();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{t("automation.title")}</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("automation.newAutomation")}</Button>
      </div>

      {showForm && <NewAutomationForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("automation.columnName")}</th>
              <th className="px-4 py-2">{t("automation.columnTrigger")}</th>
              <th className="px-4 py-2">{t("automation.columnStatus")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {automations.data?.map((automation) => (
              <AutomationRow key={automation.id} automation={automation} />
            ))}
            {automations.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  {t("automation.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AutomationRow({ automation }: { automation: Automation }) {
  const { t } = useI18n();
  const update = useUpdateAutomation(automation.id);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 font-medium text-ink">
        <Link href={`/painel/automacao/${automation.id}`} className="hover:underline">
          {automation.nome}
        </Link>
      </td>
      <td className="px-4 py-2 text-ink-dim">{t(`automation.trigger.${automation.gatilhoTipo}` as DictionaryKey)}</td>
      <td className="px-4 py-2">
        <StatusBadge status={automation.status} />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          {automation.status === "active" && (
            <button
              type="button"
              onClick={() => update.mutate({ status: "paused" })}
              className="text-xs font-medium text-ink-dim hover:underline"
            >
              {t("automation.action.pause")}
            </button>
          )}
          {automation.status === "paused" && (
            <button
              type="button"
              onClick={() => update.mutate({ status: "active" })}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {t("automation.action.activate")}
            </button>
          )}
          {automation.status !== "archived" && (
            <button
              type="button"
              onClick={() => update.mutate({ status: "archived" })}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              {t("automation.action.archive")}
            </button>
          )}
          <Link href={`/painel/automacao/${automation.id}/execucoes`} className="text-xs font-medium text-ink-dim hover:underline">
            {t("automation.action.viewExecutions")}
          </Link>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: Automation["status"] }) {
  const { t } = useI18n();
  const classes: Record<Automation["status"], string> = {
    active: "bg-brand-50 text-brand-700",
    paused: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    archived: "bg-surface-muted text-ink-faint",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {t(`automation.status.${status}` as DictionaryKey)}
    </span>
  );
}

function NewAutomationForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createAutomation = useCreateAutomation();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gatilhoTipo, setGatilhoTipo] = useState<DomainEventName>(DEFAULT_DOMAIN_EVENT);
  const [condicoes, setCondicoes] = useState<AutomationCondition[]>([]);
  const [acoes, setAcoes] = useState<AutomationAction[]>([{ tipo: "send_message", texto: "" }]);
  const [errors, setErrors] = useState<string[] | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);
    try {
      await createAutomation.mutateAsync({
        nome,
        ...(descricao ? { descricao } : {}),
        gatilhoTipo,
        condicoes,
        acoes,
      });
      onDone();
    } catch (err) {
      const body = (err as { body?: { errors?: { message: string }[] } }).body;
      setErrors(body?.errors ? body.errors.map((e2) => e2.message) : [t("automation.errorGeneric")]);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      {errors && (
        <Alert tone="error">
          <p className="font-medium">{t("automation.validationErrorsTitle")}</p>
          <ul className="mt-1 list-disc pl-4">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("automation.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("automation.description")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("automation.trigger")}</label>
        <select
          value={gatilhoTipo}
          onChange={(e) => {
            setGatilhoTipo(e.target.value as DomainEventName);
            setCondicoes([]);
          }}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          {DOMAIN_EVENTS.map((event) => (
            <option key={event} value={event}>
              {t(`automation.trigger.${event}` as DictionaryKey)}
            </option>
          ))}
        </select>
      </div>
      <ConditionsEditor gatilhoTipo={gatilhoTipo} conditions={condicoes} onChange={setCondicoes} />
      <ActionsEditor actions={acoes} onChange={setAcoes} />
      <div>
        <Button type="submit" loading={createAutomation.isPending}>
          {t("automation.create")}
        </Button>
      </div>
    </form>
  );
}
