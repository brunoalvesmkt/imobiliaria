"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DEFAULT_DOMAIN_EVENT,
  DOMAIN_EVENTS,
  useAutomation,
  useUpdateAutomation,
  type AutomationAction,
  type AutomationCondition,
  type DomainEventName,
} from "@/lib/automation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { ConditionsEditor } from "../conditions-editor";
import { ActionsEditor } from "../action-fields";

export default function EditAutomationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useI18n();
  const automation = useAutomation(id);
  const update = useUpdateAutomation(id);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gatilhoTipo, setGatilhoTipo] = useState<DomainEventName>(DEFAULT_DOMAIN_EVENT);
  const [condicoes, setCondicoes] = useState<AutomationCondition[]>([]);
  const [acoes, setAcoes] = useState<AutomationAction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!automation.data || loaded) return;
    setNome(automation.data.nome);
    setDescricao(automation.data.descricao ?? "");
    setGatilhoTipo(automation.data.gatilhoTipo);
    setCondicoes(automation.data.condicoes ?? []);
    setAcoes(automation.data.acoes);
    setLoaded(true);
  }, [automation.data, loaded]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);
    setSaved(false);
    try {
      await update.mutateAsync({ nome, descricao, gatilhoTipo, condicoes, acoes });
      setSaved(true);
    } catch (err) {
      const body = (err as { body?: { errors?: { message: string }[] } }).body;
      setErrors(body?.errors ? body.errors.map((e2) => e2.message) : [t("automation.errorGeneric")]);
    }
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
          <label className="text-sm font-medium text-ink">{t("automation.trigger")}</label>
          <select
            value={gatilhoTipo}
            onChange={(e) => setGatilhoTipo(e.target.value as DomainEventName)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            {DOMAIN_EVENTS.map((event) => (
              <option key={event} value={event}>
                {t(`automation.trigger.${event}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </div>
        <ConditionsEditor conditions={condicoes} onChange={setCondicoes} />
        <ActionsEditor actions={acoes} onChange={setAcoes} />
        <div className="flex items-center gap-3">
          <Button type="submit" loading={update.isPending}>
            {t("automation.save")}
          </Button>
          {saved && <span className="text-xs text-brand-700">{t("chatbot.builder.saved")}</span>}
        </div>
      </form>
    </div>
  );
}
