"use client";

import { useState } from "react";
import {
  useCreateKnowledgeItem,
  useDeleteKnowledgeItem,
  useKnowledgeBase,
  useUpdateKnowledgeItem,
  type KnowledgeBaseItem,
  type KnowledgeItemType,
} from "@/lib/chatbot";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const TYPES: KnowledgeItemType[] = [
  "empresa",
  "produto",
  "servico",
  "preco",
  "politica",
  "horario",
  "entrega",
  "garantia",
  "pagamento",
  "faq",
  "documento",
  "texto",
];

export default function KnowledgeBasePage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const items = useKnowledgeBase();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-dim">{t("chatbot.tabs.knowledgeBase")}</p>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("chatbot.kb.newItem")}</Button>
      </div>

      {showForm && <NewItemForm onDone={() => setShowForm(false)} />}

      <div className="flex flex-col gap-2">
        {items.data?.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
        {items.data?.length === 0 && <p className="text-sm text-ink-faint">{t("chatbot.kb.empty")}</p>}
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: KnowledgeBaseItem }) {
  const { t } = useI18n();
  const update = useUpdateKnowledgeItem();
  const deleteItem = useDeleteKnowledgeItem();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className={`rounded-lg border border-line bg-surface p-3 ${!item.ativo ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-dim">
            {t(`chatbot.kb.type.${item.tipo}` as DictionaryKey)}
          </span>
          <p className="mt-1 text-sm font-medium text-ink">{item.titulo}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-dim">{item.conteudo}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => update.mutate({ id: item.id, ativo: !item.ativo })}
            className="text-xs font-medium text-ink-dim hover:underline"
          >
            {item.ativo ? t("chatbot.kb.deactivate") : t("chatbot.kb.activate")}
          </button>
          {confirmingDelete ? (
            <>
              <button type="button" onClick={() => deleteItem.mutate(item.id)} className="text-xs font-medium text-red-600 hover:underline">
                {t("chatbot.kb.deleteConfirmYes")}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-xs font-medium text-ink-faint hover:underline">
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-red-600 hover:underline">
              {t("chatbot.kb.delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewItemForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createItem = useCreateKnowledgeItem();
  const [tipo, setTipo] = useState<KnowledgeItemType>("faq");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [variacoesText, setVariacoesText] = useState("");
  const [palavraChave, setPalavraChave] = useState("");
  const [prioridade, setPrioridade] = useState("0");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createItem.mutateAsync({
        tipo,
        titulo,
        conteudo,
        ...(tipo === "faq"
          ? {
              variacoes: variacoesText
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
              ...(palavraChave ? { palavraChave } : {}),
              prioridade: Number(prioridade) || 0,
            }
          : {}),
      });
      setTitulo("");
      setConteudo("");
      setVariacoesText("");
      setPalavraChave("");
      setPrioridade("0");
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createItem.error && <Alert tone="error">{t("chatbot.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("chatbot.kb.itemType")}</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as KnowledgeItemType)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`chatbot.kb.type.${type}` as DictionaryKey)}
              </option>
            ))}
          </select>
        </div>
        <Field label={t("chatbot.kb.itemTitle")} required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("chatbot.kb.itemContent")}</label>
        <textarea
          required
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          rows={4}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
        />
      </div>
      {tipo === "faq" && (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-line bg-surface-alt p-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-ink">{t("chatbot.kb.variations")}</label>
            <textarea
              value={variacoesText}
              onChange={(e) => setVariacoesText(e.target.value)}
              rows={3}
              placeholder={t("chatbot.kb.variationsPlaceholder")}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
            />
          </div>
          <Field label={t("chatbot.kb.keyword")} value={palavraChave} onChange={(e) => setPalavraChave(e.target.value)} />
          <Field label={t("chatbot.kb.priority")} type="number" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} />
        </div>
      )}
      <div>
        <Button type="submit" loading={createItem.isPending}>
          {t("chatbot.kb.create")}
        </Button>
      </div>
    </form>
  );
}
