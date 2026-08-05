"use client";

import { useState } from "react";
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
  CUSTOM_FIELD_TYPES,
  type CustomFieldType,
} from "@/lib/crm";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export default function CustomFieldsPage() {
  const { t } = useI18n();
  const definitions = useCustomFieldDefinitions();
  const update = useUpdateCustomFieldDefinition();
  const deleteField = useDeleteCustomFieldDefinition();
  const [showForm, setShowForm] = useState(false);

  function onDelete(id: string, nome: string) {
    if (!window.confirm(t("crm.customFields.confirmDelete").replace("{nome}", nome))) return;
    deleteField.mutate(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("crm.customFields.title")}</h1>
          <p className="mt-1 text-sm text-ink-dim">{t("crm.customFields.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("crm.customFields.new")}</Button>
      </div>

      {showForm && <NewFieldForm onDone={() => setShowForm(false)} />}

      <div className="flex flex-col gap-2">
        {definitions.data?.map((def) => (
          <div key={def.id} className={`flex items-center justify-between rounded-lg border border-line bg-surface p-3 ${!def.ativo ? "opacity-60" : ""}`}>
            <div>
              <p className="text-sm font-medium text-ink">{def.nome}</p>
              <p className="text-xs text-ink-faint">
                {t(`crm.customFields.type.${def.tipo}` as DictionaryKey)} · {def.chave}
                {def.obrigatorio ? ` · ${t("crm.customFields.required")}` : ""}
              </p>
            </div>
            <div className="flex flex-none items-center gap-3">
              <button
                type="button"
                onClick={() => update.mutate({ id: def.id, ativo: !def.ativo })}
                className="text-xs font-medium text-ink-dim hover:underline"
              >
                {def.ativo ? t("chatbot.kb.deactivate") : t("chatbot.kb.activate")}
              </button>
              <button
                type="button"
                onClick={() => onDelete(def.id, def.nome)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        ))}
        {definitions.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.customFields.empty")}</p>}
      </div>
    </div>
  );
}

function NewFieldForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const create = useCreateCustomFieldDefinition();
  const [nome, setNome] = useState("");
  const [chave, setChave] = useState("");
  const [tipo, setTipo] = useState<CustomFieldType>("texto");
  const [opcoesText, setOpcoesText] = useState("");
  const [obrigatorio, setObrigatorio] = useState(false);

  const needsOptions = tipo === "lista" || tipo === "multipla_escolha";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        nome,
        chave: chave || nome,
        tipo,
        obrigatorio,
        ...(needsOptions ? { opcoes: opcoesText.split(",").map((o) => o.trim()).filter(Boolean) } : {}),
      });
      setNome("");
      setChave("");
      setOpcoesText("");
      setObrigatorio(false);
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {create.error && <Alert tone="error">{t("crm.customFields.error")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("crm.customFields.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field
          label={t("crm.customFields.key")}
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder={nome}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.customFields.typeLabel")}</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as CustomFieldType)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            {CUSTOM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`crm.customFields.type.${type}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-dim">
          <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
          {t("crm.customFields.required")}
        </label>
      </div>
      {needsOptions && (
        <Field
          label={t("crm.customFields.options")}
          value={opcoesText}
          onChange={(e) => setOpcoesText(e.target.value)}
          placeholder={t("crm.customFields.optionsPlaceholder")}
        />
      )}
      <div>
        <Button type="submit" loading={create.isPending}>
          {t("crm.customFields.create")}
        </Button>
      </div>
    </form>
  );
}
