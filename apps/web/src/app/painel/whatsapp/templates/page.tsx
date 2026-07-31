"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useTemplates,
  useCreateTemplate,
  useSubmitTemplate,
  useApproveTemplate,
  useRejectTemplate,
  type TemplateCategory,
  type WhatsAppTemplate,
} from "@/lib/whatsapp-templates";
import { omitEmptyStrings } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const STATUS_TONE: Record<WhatsAppTemplate["status"], "default" | "warning" | "success" | "error"> = {
  draft: "default",
  pending: "warning",
  approved: "success",
  rejected: "error",
};

export default function WhatsAppTemplatesPage() {
  const { t } = useI18n();
  const templates = useTemplates();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/painel/whatsapp" className="text-xs font-medium text-brand-700 hover:underline">
          {t("whatsapp.templates.backToNumbers")}
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">{t("whatsapp.templates.title")}</h1>
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? t("common.cancel") : t("whatsapp.templates.newTemplate")}
          </Button>
        </div>
      </div>

      {showForm && <NewTemplateForm onDone={() => setShowForm(false)} />}

      {templates.isLoading && <p className="text-sm text-ink-faint">{t("common.loading")}</p>}
      {templates.isError && <Alert tone="error">{t("whatsapp.templates.errorGeneric")}</Alert>}

      <div className="flex flex-col gap-2">
        {templates.data?.length === 0 && <p className="text-sm text-ink-faint">{t("whatsapp.templates.empty")}</p>}
        {templates.data?.map((template) => <TemplateCard key={template.id} template={template} />)}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: WhatsAppTemplate }) {
  const { t } = useI18n();
  const submit = useSubmitTemplate();
  const approve = useApproveTemplate();
  const reject = useRejectTemplate();
  const tone = STATUS_TONE[template.status];

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{template.nome}</p>
          <p className="text-xs text-ink-faint">
            {t(`whatsapp.templates.category.${template.categoria}` as DictionaryKey)} · {template.idioma} · v{template.versao}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            tone === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300"
              : tone === "warning"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : tone === "error"
                  ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-surface-muted text-ink-dim"
          }`}
        >
          {t(`whatsapp.templates.status.${template.status}` as DictionaryKey)}
        </span>
      </div>

      <div className="mt-3 rounded-md bg-surface-muted p-3 text-sm text-ink">
        {template.cabecalho && <p className="font-semibold">{template.cabecalho}</p>}
        <p className="whitespace-pre-wrap">{template.corpo}</p>
        {template.rodape && <p className="mt-1 text-xs text-ink-faint">{template.rodape}</p>}
      </div>

      <div className="mt-3 flex gap-2">
        {template.status === "draft" && (
          <Button variant="secondary" loading={submit.isPending} onClick={() => submit.mutate(template.id)}>
            {t("whatsapp.templates.submit")}
          </Button>
        )}
        {template.status === "pending" && (
          <>
            <Button variant="secondary" loading={approve.isPending} onClick={() => approve.mutate(template.id)}>
              {t("whatsapp.templates.approve")}
            </Button>
            <Button variant="ghost" loading={reject.isPending} onClick={() => reject.mutate(template.id)}>
              {t("whatsapp.templates.reject")}
            </Button>
          </>
        )}
      </div>
      {template.status === "pending" && (
        <p className="mt-2 text-xs text-ink-faint">{t("whatsapp.templates.pendingNote")}</p>
      )}
    </div>
  );
}

function NewTemplateForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createTemplate = useCreateTemplate();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<TemplateCategory>("utility");
  const [cabecalho, setCabecalho] = useState("");
  const [corpo, setCorpo] = useState("");
  const [rodape, setRodape] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createTemplate.mutateAsync({
      nome,
      categoria,
      corpo,
      ...omitEmptyStrings({ cabecalho, rodape }),
    });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createTemplate.error && <Alert tone="error">{t("whatsapp.templates.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("whatsapp.templates.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("whatsapp.templates.categoryLabel")}</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as TemplateCategory)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="utility">{t("whatsapp.templates.category.utility")}</option>
            <option value="marketing">{t("whatsapp.templates.category.marketing")}</option>
            <option value="authentication">{t("whatsapp.templates.category.authentication")}</option>
          </select>
        </div>
      </div>
      <Field label={t("whatsapp.templates.header")} value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("whatsapp.templates.body")}</label>
        <textarea
          required
          rows={4}
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>
      <Field label={t("whatsapp.templates.footer")} value={rodape} onChange={(e) => setRodape(e.target.value)} />
      <div>
        <Button type="submit" loading={createTemplate.isPending}>
          {t("whatsapp.templates.create")}
        </Button>
      </div>
    </form>
  );
}
