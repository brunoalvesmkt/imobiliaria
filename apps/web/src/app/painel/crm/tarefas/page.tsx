"use client";

import { useMemo, useState } from "react";
import {
  useContacts,
  useCreateTask,
  useCreateTaskType,
  useDeleteTaskType,
  useTaskTypes,
  useTasks,
  useUpdateTask,
  useUpdateTaskType,
  type CrmTaskType,
  type CrmTaskView,
} from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { useIsAdmin } from "@/lib/auth";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

/** Documento de alterações, item 12: ao abrir Tarefas, iniciar em "Hoje". */
const VIEW_TABS: { labelKey: DictionaryKey; value: CrmTaskView }[] = [
  { labelKey: "crm.tasks.view.hoje", value: "hoje" },
  { labelKey: "crm.tasks.view.atrasadas", value: "atrasadas" },
  { labelKey: "crm.tasks.view.futuras", value: "futuras" },
  { labelKey: "crm.tasks.view.todas", value: "todas" },
];

const TIPOS_PADRAO = ["retorno", "ligacao", "reuniao", "proposta", "cobranca", "pos_venda", "avaliacao", "custom"];

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export default function TarefasPage() {
  const { t } = useI18n();
  const [view, setView] = useState<CrmTaskView>("hoje");
  const [showForm, setShowForm] = useState(false);
  const tasks = useTasks(undefined, undefined, view);
  const contacts = useContacts("");
  const updateTask = useUpdateTask();

  const contactNameById = useMemo(() => new Map((contacts.data ?? []).map((c) => [c.id, c.nome])), [contacts.data]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setView(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === tab.value ? "bg-brand-500 text-white" : "text-ink-dim hover:bg-surface-muted"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <TaskTypesMenu />
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("crm.tasks.new")}</Button>
        </div>
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
                <td className="px-4 py-2 text-ink-dim">{capitalize(task.tipo)}</td>
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
  const [selectedContact, setSelectedContact] = useState<{ id: string; nome: string } | null>(null);
  const contacts = useContacts(search);
  const taskTypes = useTaskTypes();
  const [form, setForm] = useState({ contactId: "", titulo: "", tipo: "ligacao", dataHora: "" });

  const tipoOptions = useMemo(() => {
    const customNomes = (taskTypes.data ?? []).map((tt) => tt.nome);
    const all = [...TIPOS_PADRAO, ...customNomes.filter((nome) => !TIPOS_PADRAO.includes(nome))];
    return all;
  }, [taskTypes.data]);

  function selectContact(c: { id: string; nome: string }) {
    setSelectedContact(c);
    setForm({ ...form, contactId: c.id });
  }

  function clearContact() {
    setSelectedContact(null);
    setForm({ ...form, contactId: "" });
    setSearch("");
  }

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
          {selectedContact ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm">
              <span className="text-ink">{selectedContact.nome}</span>
              <button type="button" onClick={clearContact} className="text-xs font-medium text-ink-faint hover:text-red-600">
                {t("common.remove")}
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder={t("crm.tasks.searchContact")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
              {search.length > 0 && (contacts.data?.length ?? 0) > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-lg">
                  {contacts.data!.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectContact({ id: c.id, nome: c.nome })}
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <Field label={t("crm.tasks.newTitle")} required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.tasks.type")}</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            {tipoOptions.map((tipo) => (
              <option key={tipo} value={tipo}>
                {capitalize(tipo)}
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

type TaskTypePanelKind = "create" | "edit" | "delete";

function TaskTypesMenu() {
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const [panel, setPanel] = useState<TaskTypePanelKind | null>(null);

  const items: DropdownMenuItem[] = [
    { label: t("crm.tasks.typesMenu.create"), onClick: () => setPanel("create") },
    { label: t("crm.tasks.typesMenu.edit"), onClick: () => setPanel("edit") },
    { label: t("crm.tasks.typesMenu.delete"), onClick: () => setPanel("delete") },
  ];

  if (!isAdmin) return null;

  return (
    <>
      <DropdownMenu label={t("crm.tasks.typesMenu.title")} items={items} align="right" />
      {panel === "create" && (
        <SettingsPanel title={t("crm.tasks.typesMenu.create")} onClose={() => setPanel(null)}>
          <CreateTaskTypePanel onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
      {panel === "edit" && (
        <SettingsPanel title={t("crm.tasks.typesMenu.edit")} onClose={() => setPanel(null)}>
          <EditTaskTypePanel onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
      {panel === "delete" && (
        <SettingsPanel title={t("crm.tasks.typesMenu.delete")} onClose={() => setPanel(null)}>
          <DeleteTaskTypePanel onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
    </>
  );
}

function SettingsPanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-line bg-surface p-5 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label={t("common.close")}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateTaskTypePanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createType = useCreateTaskType();
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createType.mutateAsync(nome);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.tasks.errorGeneric"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t("crm.tasks.typesMenu.nameLabel")} required value={nome} onChange={(e) => setNome(e.target.value)} />
      <div>
        <Button type="submit" loading={createType.isPending}>
          {t("crm.tasks.typesMenu.create")}
        </Button>
      </div>
    </form>
  );
}

function EditTaskTypePanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const taskTypes = useTaskTypes();
  const updateType = useUpdateTaskType();
  const [typeId, setTypeId] = useState("");
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);

  function selectType(tt: CrmTaskType) {
    setTypeId(tt.id);
    setNome(tt.nome);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!typeId) return;
    setError(null);
    try {
      await updateType.mutateAsync({ id: typeId, nome });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.tasks.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <select
        value={typeId}
        onChange={(e) => {
          const tt = taskTypes.data?.find((t2) => t2.id === e.target.value);
          if (tt) selectType(tt);
          else setTypeId("");
        }}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{t("crm.tasks.typesMenu.chooseType")}</option>
        {taskTypes.data?.map((tt) => (
          <option key={tt.id} value={tt.id}>
            {tt.nome}
          </option>
        ))}
      </select>
      {typeId && (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label={t("crm.tasks.typesMenu.nameLabel")} required value={nome} onChange={(e) => setNome(e.target.value)} />
          <div>
            <Button type="submit" loading={updateType.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
      {taskTypes.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.tasks.typesMenu.empty")}</p>}
    </div>
  );
}

function DeleteTaskTypePanel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const taskTypes = useTaskTypes();
  const deleteType = useDeleteTaskType();
  const [typeId, setTypeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!typeId) return;
    setError(null);
    try {
      await deleteType.mutateAsync(typeId);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.tasks.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <select
        value={typeId}
        onChange={(e) => {
          setTypeId(e.target.value);
          setError(null);
        }}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{t("crm.tasks.typesMenu.chooseType")}</option>
        {taskTypes.data?.map((tt) => (
          <option key={tt.id} value={tt.id}>
            {tt.nome}
          </option>
        ))}
      </select>
      {typeId && (
        <div>
          <Button variant="secondary" onClick={onDelete} loading={deleteType.isPending}>
            {t("crm.tasks.typesMenu.delete")}
          </Button>
        </div>
      )}
      {taskTypes.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.tasks.typesMenu.empty")}</p>}
    </div>
  );
}
