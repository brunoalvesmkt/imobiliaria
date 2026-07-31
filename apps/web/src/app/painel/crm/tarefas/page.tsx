"use client";

import { useMemo, useState } from "react";
import { useContacts, useCreateTask, useTasks, useUpdateTask } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const STATUS_TABS: { labelKey: DictionaryKey; value: string }[] = [
  { labelKey: "crm.tasks.tab.pending", value: "pending" },
  { labelKey: "crm.tasks.tab.done", value: "done" },
  { labelKey: "crm.tasks.tab.overdue", value: "overdue" },
  { labelKey: "crm.tasks.tab.all", value: "" },
];

const TIPOS = ["retorno", "ligacao", "reuniao", "proposta", "cobranca", "pos_venda", "avaliacao", "custom"];

export default function TarefasPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("pending");
  const [showForm, setShowForm] = useState(false);
  const tasks = useTasks(undefined, status || undefined);
  const contacts = useContacts("");
  const updateTask = useUpdateTask();

  const contactNameById = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c.nome])), [contacts.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                status === tab.value ? "bg-brand-500 text-white" : "text-ink-dim hover:bg-surface-muted"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("crm.tasks.new")}</Button>
      </div>

      {showForm && <NewTaskForm onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-alt text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2">{t("crm.tasks.columnTitle")}</th>
              <th className="px-4 py-2">{t("crm.tasks.columnContact")}</th>
              <th className="px-4 py-2">{t("crm.tasks.columnType")}</th>
              <th className="px-4 py-2">{t("crm.tasks.columnWhen")}</th>
              <th className="px-4 py-2">{t("common.status")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {tasks.data?.map((task) => (
              <tr key={task.id} className="border-b border-line last:border-0">
                <td className="px-4 py-2 text-ink">{task.titulo}</td>
                <td className="px-4 py-2 text-ink-dim">{contactNameById.get(task.contactId) ?? t("common.none")}</td>
                <td className="px-4 py-2 text-ink-dim">{task.tipo}</td>
                <td className="px-4 py-2 text-ink-dim">{new Date(task.dataHora).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  {task.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => updateTask.mutate({ id: task.id, status: "done" })}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      {t("crm.tasks.complete")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-faint">
                  {t("crm.tasks.emptyGeneric")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labels: Record<string, { key: DictionaryKey; className: string }> = {
    pending: { key: "crm.tasks.status.pending", className: "bg-surface-muted text-ink-dim" },
    done: { key: "crm.tasks.status.done", className: "bg-brand-50 text-brand-700" },
    overdue: { key: "crm.tasks.status.overdue", className: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  };
  const info = labels[status] ?? { key: "common.status" as DictionaryKey, className: "bg-surface-muted text-ink-dim" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}>{t(info.key)}</span>;
}

function NewTaskForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createTask = useCreateTask();
  const [search, setSearch] = useState("");
  const contacts = useContacts(search);
  const [form, setForm] = useState({ contactId: "", titulo: "", tipo: "ligacao", dataHora: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contactId) return;
    try {
      await createTask.mutateAsync({ ...form, dataHora: new Date(form.dataHora).toISOString() });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createTask.error && <Alert tone="error">{t("crm.tasks.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.tasks.contact")}</label>
          <input
            type="text"
            placeholder={t("crm.tasks.searchContact")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
          <select
            value={form.contactId}
            onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("crm.tasks.selectContact")}</option>
            {contacts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <Field label={t("crm.tasks.newTitle")} required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.tasks.type")}</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <Field
          label={t("crm.tasks.datetime")}
          type="datetime-local"
          required
          value={form.dataHora}
          onChange={(e) => setForm({ ...form, dataHora: e.target.value })}
        />
      </div>
      <div>
        <Button type="submit" loading={createTask.isPending} disabled={!form.contactId}>
          {t("crm.tasks.create")}
        </Button>
      </div>
    </form>
  );
}
