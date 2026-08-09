"use client";

import { useState } from "react";
import {
  useNotificationTemplates,
  useResetNotificationTemplate,
  useUpdateNotificationTemplate,
  type NotificationTemplate,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

/**
 * Edição do texto (título/corpo) e da criticidade de cada tipo de notificação que o sistema gera —
 * sem override salvo, mostra o texto padrão do backend (ver `notification-types.ts`). Os
 * títulos/corpos em si vêm sempre em português puro do backend (nunca passam por `t()`), mesmo
 * padrão já usado no resto do recurso de notificações.
 */
export function NotificationTemplatesSection() {
  const { t } = useI18n();
  const templates = useNotificationTemplates();
  const [editingTipo, setEditingTipo] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{t("notifications.templates.title")}</h2>
        <p className="mt-1 text-xs text-ink-dim">{t("notifications.templates.subtitle")}</p>
      </div>

      <div className="flex flex-col gap-2">
        {templates.data?.map((template) =>
          editingTipo === template.tipo ? (
            <TemplateEditor key={template.tipo} template={template} onDone={() => setEditingTipo(null)} />
          ) : (
            <TemplateRow key={template.tipo} template={template} onEdit={() => setEditingTipo(template.tipo)} />
          ),
        )}
      </div>
    </div>
  );
}

function TemplateRow({ template, onEdit }: { template: NotificationTemplate; onEdit: () => void }) {
  const { t } = useI18n();
  const reset = useResetNotificationTemplate();
  const update = useUpdateNotificationTemplate();

  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 ${template.ativo ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">{template.titulo}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                template.critical ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-surface-muted text-ink-faint"
              }`}
            >
              {template.critical ? t("notifications.templates.critical") : t("notifications.templates.notCritical")}
            </span>
            {template.customized && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                {t("notifications.templates.customized")}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-dim">{template.corpo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
            <input
              type="checkbox"
              checked={template.ativo}
              onChange={(e) => update.mutate({ tipo: template.tipo, ativo: e.target.checked })}
            />
            {t("notifications.templates.activeToggle")}
          </label>
          <button type="button" onClick={onEdit} className="text-xs font-medium text-ink-dim hover:underline">
            {t("common.edit")}
          </button>
          {template.customized && (
            <button type="button" onClick={() => reset.mutate(template.tipo)} className="text-xs font-medium text-red-600 hover:underline">
              {t("notifications.templates.restoreDefault")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({ template, onDone }: { template: NotificationTemplate; onDone: () => void }) {
  const { t } = useI18n();
  const update = useUpdateNotificationTemplate();
  const [titulo, setTitulo] = useState(template.titulo);
  const [corpo, setCorpo] = useState(template.corpo);
  const [critical, setCritical] = useState(template.critical);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-alt p-4">
      <Field label={t("notifications.templates.fieldTitle")} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("notifications.templates.fieldBody")}</label>
        <textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={3}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>
      {template.placeholders.length > 0 && (
        <p className="text-xs text-ink-faint">
          {t("notifications.templates.placeholdersHint")}{" "}
          {template.placeholders.map((p) => (
            <code key={p.key} className="mr-2 rounded bg-surface-muted px-1 py-0.5">{`{{${p.key}}}`}</code>
          ))}
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={critical} onChange={(e) => setCritical(e.target.checked)} />
        {t("notifications.templates.criticalToggle")}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          loading={update.isPending}
          onClick={async () => {
            await update.mutateAsync({ tipo: template.tipo, titulo, corpo, critical });
            onDone();
          }}
        >
          {t("common.save")}
        </Button>
        <button type="button" onClick={onDone} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
