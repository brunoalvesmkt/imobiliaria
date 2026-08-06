"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AUTOMATION_CATEGORIES,
  TRIGGER_PARAM_KEY,
  useActivateTemplate,
  useAutomationCatalog,
  useAutomations,
  useAutomationTemplates,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  type Automation,
  type AutomationAction,
  type AutomationCategory,
  type AutomationCondition,
  type AutomationTemplate,
  type DomainEventName,
} from "@/lib/automation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { ConditionsEditor } from "./conditions-editor";
import { ActionsEditor } from "./action-fields";

export default function AutomationPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterTipo, setFilterTipo] = useState<AutomationCategory | "">("");
  const automations = useAutomations();

  const filtered = automations.data?.filter((a) => !filterTipo || a.tipoAutomacao === filterTipo);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{t("automation.title")}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setShowTemplates((v) => !v);
              setShowForm(false);
            }}
          >
            {showTemplates ? t("common.cancel") : t("automation.templates.useTemplate")}
          </Button>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
              setShowTemplates(false);
            }}
          >
            {showForm ? t("common.cancel") : t("automation.newAutomation")}
          </Button>
        </div>
      </div>

      {showTemplates && <TemplatesPanel onDone={() => setShowTemplates(false)} />}
      {showForm && <NewAutomationForm onDone={() => setShowForm(false)} />}

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-ink-dim">{t("automation.columnType")}</label>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as AutomationCategory | "")}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        >
          <option value="">{t("automation.filterAllTypes")}</option>
          {AUTOMATION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`automation.category.${cat}` as DictionaryKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("automation.columnName")}</th>
              <th className="px-4 py-2">{t("automation.columnType")}</th>
              <th className="px-4 py-2">{t("automation.columnTrigger")}</th>
              <th className="px-4 py-2">{t("automation.columnStatus")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered?.map((automation) => (
              <AutomationRow key={automation.id} automation={automation} />
            ))}
            {filtered?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
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
  const deleteAutomation = useDeleteAutomation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteAutomation.mutateAsync(automation.id);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("automation.action.deleteErrorGeneric"));
      setConfirmingDelete(false);
    }
  }

  return (
    <>
      <tr className="border-b border-line last:border-0">
      <td className="px-4 py-2 font-medium text-ink">
        <Link href={`/painel/automacao/${automation.id}`} className="hover:underline">
          {automation.nome}
        </Link>
      </td>
      <td className="px-4 py-2 text-ink-dim">
        {automation.tipoAutomacao ? t(`automation.category.${automation.tipoAutomacao}` as DictionaryKey) : "—"}
      </td>
      <td className="px-4 py-2 text-ink-dim">{t(`automation.trigger.${automation.gatilhoTipo}` as DictionaryKey)}</td>
      <td className="px-4 py-2">
        <StatusBadge status={automation.status} />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
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
          {confirmingDelete ? (
            <>
              <span className="text-xs text-ink-dim">{t("automation.action.deleteConfirmText")}</span>
              <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
                {t("automation.action.deleteConfirmYes")}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-xs font-medium text-ink-faint hover:underline">
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-red-600 hover:underline">
              {t("automation.action.delete")}
            </button>
          )}
        </div>
      </td>
      </tr>
      {deleteError && (
        <tr>
          <td colSpan={5} className="px-4 pb-2">
            <Alert tone="error">{deleteError}</Alert>
          </td>
        </tr>
      )}
    </>
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

function TemplatesPanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const templates = useAutomationTemplates();
  const activate = useActivateTemplate();
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activatedId, setActivatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onActivate(template: AutomationTemplate) {
    setError(null);
    setActivatingId(template.id);
    try {
      await activate.mutateAsync({
        templateId: template.id,
        nome: t(`automation.templates.${template.id}.nome` as DictionaryKey),
      });
      setActivatedId(template.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("automation.errorGeneric"));
    } finally {
      setActivatingId(null);
    }
  }

  const available = (templates.data ?? []).filter((tpl) => tpl.available);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">{t("automation.templates.title")}</h2>
        <p className="mt-1 text-xs text-ink-dim">{t("automation.templates.subtitle")}</p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((tpl) => (
          <div key={tpl.id} className="flex flex-col gap-2 rounded-md border border-line bg-surface-alt p-3">
            <div>
              <p className="text-sm font-medium text-ink">{t(`automation.templates.${tpl.id}.nome` as DictionaryKey)}</p>
              <p className="mt-1 text-xs text-ink-dim">{t(`automation.templates.${tpl.id}.descricao` as DictionaryKey)}</p>
            </div>
            {tpl.categoria && (
              <span className="w-fit rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-faint">
                {t(`automation.category.${tpl.categoria}` as DictionaryKey)}
              </span>
            )}
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onActivate(tpl)}
                loading={activatingId === tpl.id}
                disabled={activatedId === tpl.id}
              >
                {activatedId === tpl.id ? t("automation.templates.activated") : t("automation.templates.activate")}
              </Button>
            </div>
          </div>
        ))}
        {available.length === 0 && <p className="text-xs text-ink-faint">{t("automation.templates.empty")}</p>}
      </div>
      <div>
        <button type="button" onClick={onDone} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function NewAutomationForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createAutomation = useCreateAutomation();
  const catalog = useAutomationCatalog();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoAutomacao, setTipoAutomacao] = useState<AutomationCategory | "">("");
  const [gatilhoTipo, setGatilhoTipo] = useState<DomainEventName | "">("");
  const [condicoes, setCondicoes] = useState<AutomationCondition[]>([]);
  const [acoes, setAcoes] = useState<AutomationAction[]>([{ tipo: "send_message", texto: "" }]);
  const [cooldownMinutos, setCooldownMinutos] = useState("");
  const [gatilhoParametroValor, setGatilhoParametroValor] = useState("");
  const [errors, setErrors] = useState<string[] | null>(null);

  const availableTriggers = (catalog.data?.triggers ?? []).filter(
    (trig) => trig.available && (!tipoAutomacao || trig.category === tipoAutomacao),
  );
  const availableActions = (catalog.data?.actions ?? []).filter((a) => a.available).map((a) => a.tipo);
  const fields = catalog.data?.triggers.find((trig) => trig.event === gatilhoTipo)?.fields ?? [];
  const paramKey = gatilhoTipo ? TRIGGER_PARAM_KEY[gatilhoTipo] : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);
    if (!gatilhoTipo) {
      setErrors([t("automation.errorGeneric")]);
      return;
    }
    try {
      await createAutomation.mutateAsync({
        nome,
        ...(descricao ? { descricao } : {}),
        ...(tipoAutomacao ? { tipoAutomacao } : {}),
        gatilhoTipo,
        condicoes,
        acoes,
        ...(cooldownMinutos ? { cooldownMinutos: Number(cooldownMinutos) } : {}),
        ...(paramKey && gatilhoParametroValor ? { gatilhoParametros: { [paramKey]: Number(gatilhoParametroValor) } } : {}),
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
        <label className="text-sm font-medium text-ink">{t("automation.columnType")}</label>
        <select
          value={tipoAutomacao}
          onChange={(e) => {
            setTipoAutomacao(e.target.value as AutomationCategory | "");
            setGatilhoTipo("");
            setCondicoes([]);
          }}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">{t("automation.filterAllTypes")}</option>
          {AUTOMATION_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`automation.category.${cat}` as DictionaryKey)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("automation.trigger")}</label>
        <select
          value={gatilhoTipo}
          onChange={(e) => {
            setGatilhoTipo(e.target.value as DomainEventName);
            setCondicoes([]);
            setGatilhoParametroValor("");
          }}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="" />
          {availableTriggers.map((trig) => (
            <option key={trig.event} value={trig.event}>
              {t(`automation.trigger.${trig.event}` as DictionaryKey)}
            </option>
          ))}
        </select>
      </div>
      {paramKey && (
        <div className="flex flex-col gap-1">
          <Field
            label={t(`automation.trigger.param.${paramKey}` as DictionaryKey)}
            type="number"
            min={1}
            required
            value={gatilhoParametroValor}
            onChange={(e) => setGatilhoParametroValor(e.target.value)}
            className="max-w-xs"
          />
          <p className="text-xs text-ink-faint">{t("automation.trigger.dataHint")}</p>
        </div>
      )}
      <ConditionsEditor fields={fields} conditions={condicoes} onChange={setCondicoes} />
      <ActionsEditor actionTypes={availableActions} actions={acoes} onChange={setAcoes} />
      <Field
        label={t("automation.cooldownMinutos")}
        type="number"
        min={1}
        value={cooldownMinutos}
        onChange={(e) => setCooldownMinutos(e.target.value)}
        className="max-w-xs"
      />
      <div>
        <Button type="submit" loading={createAutomation.isPending}>
          {t("automation.create")}
        </Button>
      </div>
    </form>
  );
}
