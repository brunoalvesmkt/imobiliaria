"use client";

import { useMemo, useState } from "react";
import { useCreateTask, useTasks, useTaskTypes, useUpdateTask } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

export function ContactTasks({ contactId }: { contactId: string }) {
  const { t } = useI18n();
  const tasks = useTasks(contactId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const taskTypes = useTaskTypes();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ titulo: "", tipo: "", dataHora: "" });

  const tipoOptions = useMemo(
    () => (taskTypes.data ?? []).filter((tt) => tt.ativo).map((tt) => tt.nome),
    [taskTypes.data],
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    await createTask.mutateAsync({ contactId, titulo: form.titulo, tipo: form.tipo, dataHora: new Date(form.dataHora).toISOString() });
    setForm({ titulo: "", tipo: "", dataHora: "" });
    setShowForm(false);
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t("crm.tasks.title")}</h2>
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("crm.tasks.new")}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 flex flex-col gap-3 rounded-md bg-surface-alt p-3">
          <Field label={t("crm.tasks.newTitle")} required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">{t("crm.tasks.type")}</label>
              <select
                required
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  {t("crm.tasks.typesMenu.chooseType")}
                </option>
                {tipoOptions.map((tipo) => (
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
            <Button type="submit" loading={createTask.isPending}>
              {t("crm.tasks.create")}
            </Button>
          </div>
        </form>
      )}

      <ul className="flex flex-col gap-2">
        {tasks.data?.map((task) => (
          <li key={task.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
            <div>
              <p className={task.status === "done" ? "text-ink-faint line-through" : "text-ink"}>{task.titulo}</p>
              <p className="text-xs text-ink-faint">
                {task.tipo} · {new Date(task.dataHora).toLocaleString()}
              </p>
            </div>
            {task.status !== "done" && (
              <Button variant="secondary" onClick={() => updateTask.mutate({ id: task.id, status: "done" })} loading={updateTask.isPending}>
                {t("crm.tasks.complete")}
              </Button>
            )}
          </li>
        ))}
        {tasks.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.tasks.emptyForContact")}</p>}
      </ul>
    </section>
  );
}
