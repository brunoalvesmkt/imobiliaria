"use client";

import { useState } from "react";
import {
  useQuickMessages,
  useCreateQuickMessage,
  useUpdateQuickMessage,
  useDeleteQuickMessage,
  type QuickMessage,
} from "@/lib/quick-messages";
import { useIsAtendimentoAdmin } from "@/lib/auth";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function QuickMessagesPage() {
  const { t } = useI18n();
  const isAdmin = useIsAtendimentoAdmin();
  const messages = useQuickMessages(undefined, isAdmin);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">{t("atendimento.quickMessages.title")}</h1>
          <p className="mt-1 text-sm text-ink-dim">{t("atendimento.quickMessages.subtitle")}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? t("common.cancel") : t("atendimento.quickMessages.new")}
          </Button>
        )}
      </div>

      {showForm && <NewQuickMessageForm onDone={() => setShowForm(false)} />}

      <div className="flex flex-col gap-2">
        {messages.data?.map((msg) => (
          <QuickMessageCard key={msg.id} message={msg} isAdmin={isAdmin} />
        ))}
        {messages.data?.length === 0 && <p className="text-sm text-ink-faint">{t("atendimento.quickMessages.empty")}</p>}
      </div>
    </div>
  );
}

function QuickMessageCard({ message, isAdmin }: { message: QuickMessage; isAdmin: boolean }) {
  const { t } = useI18n();
  const update = useUpdateQuickMessage();
  const deleteMessage = useDeleteQuickMessage();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteMessage.mutateAsync(message.id);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("atendimento.quickMessages.error"));
      setConfirmingDelete(false);
    }
  }

  return (
    <div className={`rounded-lg border border-line bg-surface p-3 ${!message.ativo ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">
            {message.titulo} {message.atalho && <span className="ml-1 text-xs text-ink-faint">{message.atalho}</span>}
          </p>
          {message.categoria && <p className="text-xs text-ink-faint">{message.categoria}</p>}
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-dim">{message.texto}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-none items-center gap-2">
            <button type="button" onClick={() => setEditing((v) => !v)} className="text-xs font-medium text-brand-700 hover:underline">
              {t("common.edit")}
            </button>
            <button
              type="button"
              onClick={() => update.mutate({ id: message.id, ativo: !message.ativo })}
              className="text-xs font-medium text-ink-dim hover:underline"
            >
              {message.ativo ? t("chatbot.kb.deactivate") : t("chatbot.kb.activate")}
            </button>
            {confirmingDelete ? (
              <>
                <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
                  {t("atendimento.quickMessages.deleteConfirmYes")}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="text-xs font-medium text-ink-faint hover:underline">
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-red-600 hover:underline">
                {t("atendimento.quickMessages.delete")}
              </button>
            )}
          </div>
        )}
      </div>

      {deleteError && (
        <div className="mt-2">
          <Alert tone="error">{deleteError}</Alert>
        </div>
      )}

      {isAdmin && editing && <EditQuickMessageForm message={message} onDone={() => setEditing(false)} />}
    </div>
  );
}

function EditQuickMessageForm({ message, onDone }: { message: QuickMessage; onDone: () => void }) {
  const { t } = useI18n();
  const update = useUpdateQuickMessage();
  const [titulo, setTitulo] = useState(message.titulo);
  const [texto, setTexto] = useState(message.texto);
  const [categoria, setCategoria] = useState(message.categoria ?? "");
  const [atalho, setAtalho] = useState(message.atalho ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: message.id, titulo, texto, categoria, atalho });
      onDone();
    } catch {
      // erro exibido no card
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
      {update.error && <Alert tone="error">{t("atendimento.quickMessages.error")}</Alert>}
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
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={update.isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
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
