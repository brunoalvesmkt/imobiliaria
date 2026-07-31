"use client";

import { useState } from "react";
import { useQuickMessages, useCreateQuickMessage, useUpdateQuickMessage } from "@/lib/quick-messages";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";

export default function QuickMessagesPage() {
  const { t } = useI18n();
  const messages = useQuickMessages();
  const update = useUpdateQuickMessage();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("atendimento.quickMessages.title")}</h1>
          <p className="mt-1 text-sm text-ink-dim">{t("atendimento.quickMessages.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("atendimento.quickMessages.new")}</Button>
      </div>

      {showForm && <NewQuickMessageForm onDone={() => setShowForm(false)} />}

      <div className="flex flex-col gap-2">
        {messages.data?.map((msg) => (
          <div key={msg.id} className={`rounded-lg border border-line bg-surface p-3 ${!msg.ativo ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">
                  {msg.titulo} {msg.atalho && <span className="ml-1 text-xs text-ink-faint">{msg.atalho}</span>}
                </p>
                {msg.categoria && <p className="text-xs text-ink-faint">{msg.categoria}</p>}
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-dim">{msg.texto}</p>
              </div>
              <button
                type="button"
                onClick={() => update.mutate({ id: msg.id, ativo: !msg.ativo })}
                className="flex-none text-xs font-medium text-ink-dim hover:underline"
              >
                {msg.ativo ? t("chatbot.kb.deactivate") : t("chatbot.kb.activate")}
              </button>
            </div>
          </div>
        ))}
        {messages.data?.length === 0 && <p className="text-sm text-ink-faint">{t("atendimento.quickMessages.empty")}</p>}
      </div>
    </div>
  );
}

function NewQuickMessageForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const create = useCreateQuickMessage();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [atalho, setAtalho] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ titulo, texto, ...(categoria ? { categoria } : {}), ...(atalho ? { atalho } : {}) });
      setTitulo("");
      setTexto("");
      setCategoria("");
      setAtalho("");
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {create.error && <Alert tone="error">{t("atendimento.quickMessages.error")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t("atendimento.quickMessages.titleLabel")} required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <Field label={t("atendimento.quickMessages.category")} value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <Field label={t("atendimento.quickMessages.shortcut")} value={atalho} onChange={(e) => setAtalho(e.target.value)} placeholder="/saudacao" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("atendimento.quickMessages.textLabel")}</label>
        <textarea
          required
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder={t("atendimento.quickMessages.textPlaceholder")}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
        />
      </div>
      <div>
        <Button type="submit" loading={create.isPending}>
          {t("atendimento.quickMessages.create")}
        </Button>
      </div>
    </form>
  );
}
