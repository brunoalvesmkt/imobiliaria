"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AUTOMATION_CATEGORIES,
  DEFAULT_DOMAIN_EVENT,
  TRIGGER_PARAM_KEY,
  useAutomation,
  useAutomationCatalog,
  useSimulateAutomation,
  useUpdateAutomation,
  type AutomationAction,
  type AutomationCategory,
  type AutomationCondition,
  type DomainEventName,
  type ExecutedStep,
} from "@/lib/automation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { ConditionsEditor } from "../conditions-editor";
import { ActionsEditor } from "../action-fields";
import { ExecutionSteps } from "../execution-steps";

export default function EditAutomationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useI18n();
  const automation = useAutomation(id);
  const update = useUpdateAutomation(id);
  const catalog = useAutomationCatalog();
  const simulate = useSimulateAutomation(id);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoAutomacao, setTipoAutomacao] = useState<AutomationCategory | "">("");
  const [gatilhoTipo, setGatilhoTipo] = useState<DomainEventName>(DEFAULT_DOMAIN_EVENT);
  const [condicoes, setCondicoes] = useState<AutomationCondition[]>([]);
  const [acoes, setAcoes] = useState<AutomationAction[]>([]);
  const [cooldownMinutos, setCooldownMinutos] = useState("");
  const [gatilhoParametroValor, setGatilhoParametroValor] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [simContactId, setSimContactId] = useState("");
  const [simConversationId, setSimConversationId] = useState("");
  const [simPassos, setSimPassos] = useState<ExecutedStep[] | null>(null);

  useEffect(() => {
    if (!automation.data || loaded) return;
    setNome(automation.data.nome);
    setDescricao(automation.data.descricao ?? "");
    setTipoAutomacao(automation.data.tipoAutomacao ?? "");
    setGatilhoTipo(automation.data.gatilhoTipo);
    setCondicoes(automation.data.condicoes ?? []);
    setAcoes(automation.data.acoes);
    setCooldownMinutos(automation.data.cooldownMinutos ? String(automation.data.cooldownMinutos) : "");
    const paramKeyAtual = TRIGGER_PARAM_KEY[automation.data.gatilhoTipo];
    const paramValorAtual = paramKeyAtual ? automation.data.gatilhoParametros?.[paramKeyAtual] : undefined;
    setGatilhoParametroValor(paramValorAtual !== undefined ? String(paramValorAtual) : "");
    setLoaded(true);
  }, [automation.data, loaded]);

  const availableTriggers = (catalog.data?.triggers ?? []).filter(
    (trig) => trig.available && (!tipoAutomacao || trig.category === tipoAutomacao),
  );
  const availableActions = (catalog.data?.actions ?? []).filter((a) => a.available).map((a) => a.tipo);
  const fields = catalog.data?.triggers.find((trig) => trig.event === gatilhoTipo)?.fields ?? [];
  const paramKey = TRIGGER_PARAM_KEY[gatilhoTipo];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);
    setSaved(false);
    try {
      await update.mutateAsync({
        nome,
        descricao,
        ...(tipoAutomacao ? { tipoAutomacao } : {}),
        gatilhoTipo,
        condicoes,
        acoes,
        cooldownMinutos: cooldownMinutos ? Number(cooldownMinutos) : null,
        gatilhoParametros: paramKey && gatilhoParametroValor ? { [paramKey]: Number(gatilhoParametroValor) } : null,
      });
      setSaved(true);
    } catch (err) {
      const body = (err as { body?: { errors?: { message: string }[] } }).body;
      setErrors(body?.errors ? body.errors.map((e2) => e2.message) : [t("automation.errorGeneric")]);
    }
  }

  async function onSimulate() {
    setSimPassos(null);
    const resultado = await simulate.mutateAsync({
      ...(simContactId ? { contactId: simContactId } : {}),
      ...(simConversationId ? { conversationId: simConversationId } : {}),
    });
    setSimPassos(resultado.passos);
  }

  if (!loaded) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/painel/automacao" className="text-xs font-medium text-ink-dim hover:text-ink">
          ← {t("automation.back")}
        </Link>
        <Link href={`/painel/automacao/${id}/execucoes`} className="text-xs font-medium text-ink-dim hover:underline">
          {t("automation.action.viewExecutions")}
        </Link>
      </div>

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
        <div className="flex items-center gap-3">
          <Button type="submit" loading={update.isPending}>
            {t("automation.save")}
          </Button>
          {saved && <span className="text-xs text-brand-700">{t("chatbot.builder.saved")}</span>}
        </div>
      </form>

      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("automation.simulate.title")}</h2>
          <p className="mt-1 text-xs text-ink-dim">{t("automation.simulate.subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("automation.simulate.contactId")} value={simContactId} onChange={(e) => setSimContactId(e.target.value)} />
          <Field
            label={t("automation.simulate.conversationId")}
            value={simConversationId}
            onChange={(e) => setSimConversationId(e.target.value)}
          />
        </div>
        <div>
          <Button type="button" variant="secondary" onClick={onSimulate} loading={simulate.isPending}>
            {t("automation.simulate.run")}
          </Button>
        </div>
        {simPassos && <ExecutionSteps passos={simPassos} />}
      </div>
    </div>
  );
}
