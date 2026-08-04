"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useArchiveFlow,
  useCreateFlow,
  useDeleteFlow,
  useDuplicateFlow,
  useFlows,
  useNewFlowVersion,
  usePauseFlow,
  usePublishFlow,
  useUpdateFlow,
  type ChatbotFlow,
} from "@/lib/chatbot";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export default function ChatbotFlowsPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const flows = useFlows();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-dim">{t("chatbot.tabs.flows")}</p>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("chatbot.newFlow")}</Button>
      </div>

      {showForm && <NewFlowForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("chatbot.columnName")}</th>
              <th className="px-4 py-2">{t("chatbot.columnStatus")}</th>
              <th className="px-4 py-2">{t("chatbot.columnVersion")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {flows.data?.map((flow) => (
              <FlowRow key={flow.id} flow={flow} />
            ))}
            {flows.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-faint">
                  {t("chatbot.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FlowRow({ flow }: { flow: ChatbotFlow }) {
  const { t } = useI18n();
  const publish = usePublishFlow();
  const pause = usePauseFlow();
  const archive = useArchiveFlow();
  const newVersion = useNewFlowVersion();
  const deleteFlow = useDeleteFlow();
  const duplicateFlow = useDuplicateFlow();
  const [publishErrors, setPublishErrors] = useState<string[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  async function onDuplicate() {
    setDuplicateError(null);
    try {
      await duplicateFlow.mutateAsync(flow.id);
    } catch (err) {
      setDuplicateError(err instanceof ApiError ? err.message : t("chatbot.errorGeneric"));
    }
  }

  async function onDelete() {
    setDeleteError(null);
    try {
      await deleteFlow.mutateAsync(flow.id);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : t("chatbot.errorGeneric"));
      setConfirmingDelete(false);
    }
  }

  async function onPublish() {
    setPublishErrors(null);
    try {
      await publish.mutateAsync(flow.id);
    } catch (err) {
      const body = (err as { body?: { errors?: { message: string }[] } }).body;
      if (body?.errors) {
        setPublishErrors(body.errors.map((e) => e.message));
      } else {
        setPublishErrors([t("chatbot.errorGeneric")]);
      }
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-line last:border-0 align-top">
        <td colSpan={4} className="px-4 py-3">
          <EditFlowForm flow={flow} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-line last:border-0 align-top">
      <td className="px-4 py-2 font-medium text-ink">
        <Link href={`/painel/chatbot/fluxos/${flow.id}`} className="hover:underline">
          {flow.nome}
        </Link>
        {publishErrors && (
          <div className="mt-2 max-w-md">
            <Alert tone="error">
              <p className="font-medium">{t("chatbot.publishErrorsTitle")}</p>
              <ul className="mt-1 list-disc pl-4">
                {publishErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </Alert>
          </div>
        )}
        {duplicateError && (
          <div className="mt-2 max-w-md">
            <Alert tone="error">{duplicateError}</Alert>
          </div>
        )}
      </td>
      <td className="px-4 py-2">
        <StatusBadge status={flow.status} />
      </td>
      <td className="px-4 py-2 text-ink-dim">{flow.versaoAtual}</td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-ink-dim hover:underline">
            {t("chatbot.action.edit")}
          </button>
          <button
            type="button"
            disabled={duplicateFlow.isPending}
            onClick={onDuplicate}
            className="text-xs font-medium text-ink-dim hover:underline disabled:opacity-50"
          >
            {t("chatbot.action.duplicate")}
          </button>
          {flow.status === "draft" && (
            <button type="button" onClick={onPublish} className="text-xs font-medium text-brand-700 hover:underline">
              {t("chatbot.action.publish")}
            </button>
          )}
          {flow.status === "published" && (
            <button type="button" onClick={() => pause.mutate(flow.id)} className="text-xs font-medium text-ink-dim hover:underline">
              {t("chatbot.action.pause")}
            </button>
          )}
          {(flow.status === "published" || flow.status === "paused") && (
            <button
              type="button"
              onClick={() => newVersion.mutate(flow.id)}
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              {t("chatbot.action.newVersion")}
            </button>
          )}
          {flow.status !== "archived" && (
            <button type="button" onClick={() => archive.mutate(flow.id)} className="text-xs font-medium text-red-600 hover:underline">
              {t("chatbot.action.archive")}
            </button>
          )}
          {confirmingDelete ? (
            <>
              <span className="text-xs text-ink-dim">{t("chatbot.action.deleteConfirmText")}</span>
              <button type="button" onClick={onDelete} className="text-xs font-medium text-red-600 hover:underline">
                {t("chatbot.action.deleteConfirmYes")}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="text-xs font-medium text-ink-faint hover:underline">
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-red-600 hover:underline">
              {t("chatbot.action.delete")}
            </button>
          )}
        </div>
        {deleteError && (
          <div className="mt-2 max-w-md">
            <Alert tone="error">{deleteError}</Alert>
          </div>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ChatbotFlow["status"] }) {
  const { t } = useI18n();
  const classes: Record<ChatbotFlow["status"], string> = {
    draft: "bg-surface-muted text-ink-dim",
    published: "bg-brand-50 text-brand-700",
    paused: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    archived: "bg-surface-muted text-ink-faint",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}>
      {t(`chatbot.status.${status}` as DictionaryKey)}
    </span>
  );
}

function EditFlowForm({ flow, onDone, onCancel }: { flow: ChatbotFlow; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const updateFlow = useUpdateFlow();
  const [nome, setNome] = useState(flow.nome);
  const [descricao, setDescricao] = useState(flow.descricao ?? "");
  const [aiEnabled, setAiEnabled] = useState(flow.aiEnabled);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateFlow.mutateAsync({ id: flow.id, nome, descricao, aiEnabled });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface-alt p-4">
      {updateFlow.error && (
        <Alert tone="error">{updateFlow.error instanceof ApiError ? updateFlow.error.message : t("chatbot.errorGeneric")}</Alert>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("chatbot.flowName")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("chatbot.flowDescription")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-dim">
        <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
        {t("chatbot.aiEnabledLabel")}
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={updateFlow.isPending}>
          {t("common.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

function NewFlowForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createFlow = useCreateFlow();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [aiEnabled, setAiEnabled] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createFlow.mutateAsync({ nome, ...(descricao ? { descricao } : {}), aiEnabled });
      setNome("");
      setDescricao("");
      setAiEnabled(false);
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createFlow.error && <Alert tone="error">{t("chatbot.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("chatbot.flowName")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("chatbot.flowDescription")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-dim">
        <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
        {t("chatbot.aiEnabledLabel")}
      </label>
      <div>
        <Button type="submit" loading={createFlow.isPending}>
          {t("chatbot.createFlow")}
        </Button>
      </div>
    </form>
  );
}
