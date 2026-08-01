"use client";

import { useState } from "react";
import { AVAILABLE_MODULES, useCreateMasterPlan, useDeleteMasterPlan, useMasterPlans, useUpdateMasterPlan, type MasterPlan } from "@/lib/master-plans";
import { useCurrentMasterUser } from "@/lib/master-auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { apiUrl, ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function MasterPlansPage() {
  const { t } = useI18n();
  const [showForm, setShowForm] = useState(false);
  const plans = useMasterPlans();
  const currentUser = useCurrentMasterUser();
  const canManage = currentUser.data?.masterRole === "super_admin";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">{t("master.plans.title")}</h1>
        <div className="flex items-center gap-3">
          <a href={apiUrl("/master/plans/export")} className="text-sm text-accent hover:underline">
            {t("master.export.csv")}
          </a>
          {canManage && (
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common.cancel") : t("master.plans.newPlan")}</Button>
          )}
        </div>
      </div>

      {showForm && <NewPlanForm onDone={() => setShowForm(false)} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.data?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} canManage={canManage} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, canManage }: { plan: MasterPlan; canManage: boolean }) {
  const { t } = useI18n();
  const updatePlan = useUpdateMasterPlan(plan.id);
  const deletePlan = useDeleteMasterPlan();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preco = Number(plan.preco).toLocaleString(undefined, { style: "currency", currency: "BRL" });

  async function onDelete() {
    setError(null);
    if (!window.confirm(t("master.plans.confirmDelete"))) return;
    try {
      await deletePlan.mutateAsync(plan.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("master.plans.errorGeneric"));
    }
  }

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-4 ${plan.ativo ? "border-line bg-surface" : "border-line bg-surface-muted opacity-70"}`}>
      <p className="text-sm font-semibold text-ink">{plan.nome}</p>
      {plan.descricao && <p className="text-xs text-ink-dim">{plan.descricao}</p>}
      <p className="text-lg font-semibold text-ink">
        {preco}
        <span className="text-xs font-normal text-ink-faint">/{t(`master.plans.recurrence.${plan.recorrencia}`)}</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {plan.modulos.map((m) => (
          <span key={m} className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-ink-dim">
            {m}
          </span>
        ))}
      </div>
      <div className="flex gap-3 text-xs text-ink-faint">
        {plan.iaIncluida && <span>{t("master.plans.aiIncluded")}</span>}
        {plan.apiOficial && <span>{t("master.plans.officialApi")}</span>}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {canManage && (
        <div className="mt-1 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => updatePlan.mutate({ ativo: !plan.ativo })}
            className="text-left text-xs font-medium text-ink-dim hover:underline"
          >
            {plan.ativo ? t("master.plans.deactivate") : t("master.plans.activate")}
          </button>
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-left text-xs font-medium text-brand-700 hover:underline">
            {editing ? t("common.cancel") : t("master.plans.edit")}
          </button>
          <button type="button" onClick={onDelete} className="text-left text-xs font-medium text-red-600 hover:underline">
            {t("common.remove")}
          </button>
        </div>
      )}

      {editing && <EditPlanForm plan={plan} onDone={() => setEditing(false)} />}
    </div>
  );
}

function EditPlanForm({ plan, onDone }: { plan: MasterPlan; onDone: () => void }) {
  const { t } = useI18n();
  const updatePlan = useUpdateMasterPlan(plan.id);
  const [nome, setNome] = useState(plan.nome);
  const [descricao, setDescricao] = useState(plan.descricao ?? "");
  const [preco, setPreco] = useState(plan.preco);
  const [recorrencia, setRecorrencia] = useState(plan.recorrencia);
  const [modulos, setModulos] = useState<string[]>(plan.modulos);
  const [iaIncluida, setIaIncluida] = useState(plan.iaIncluida);
  const [apiOficial, setApiOficial] = useState(plan.apiOficial);

  function toggleModule(module: string) {
    setModulos((current) => (current.includes(module) ? current.filter((m) => m !== module) : [...current, module]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePlan.mutateAsync({
        nome,
        descricao,
        preco: Number(preco),
        recorrencia,
        modulos,
        iaIncluida,
        apiOficial,
      });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-3 rounded-md border border-line bg-surface-alt p-3">
      {updatePlan.error && <Alert tone="error">{t("master.plans.errorGeneric")}</Alert>}
      <Field label={t("master.plans.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
      <Field label={t("master.plans.description")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <Field label={t("master.plans.price")} type="number" min="0" step="0.01" required value={preco} onChange={(e) => setPreco(e.target.value)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("master.plans.recurrence")}</label>
        <select
          value={recorrencia}
          onChange={(e) => setRecorrencia(e.target.value as "mensal" | "anual")}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="mensal">{t("master.plans.recurrence.mensal")}</option>
          <option value="anual">{t("master.plans.recurrence.anual")}</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {AVAILABLE_MODULES.map((module) => (
          <button
            key={module}
            type="button"
            onClick={() => toggleModule(module)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              modulos.includes(module) ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint"
            }`}
          >
            {module}
          </button>
        ))}
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={iaIncluida} onChange={(e) => setIaIncluida(e.target.checked)} />
          {t("master.plans.aiIncluded")}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={apiOficial} onChange={(e) => setApiOficial(e.target.checked)} />
          {t("master.plans.officialApi")}
        </label>
      </div>
      <div>
        <Button type="submit" loading={updatePlan.isPending}>
          {t("master.plans.save")}
        </Button>
      </div>
    </form>
  );
}

function NewPlanForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const createPlan = useCreateMasterPlan();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [recorrencia, setRecorrencia] = useState<"mensal" | "anual">("mensal");
  const [modulos, setModulos] = useState<string[]>([]);
  const [iaIncluida, setIaIncluida] = useState(false);
  const [apiOficial, setApiOficial] = useState(false);

  function toggleModule(module: string) {
    setModulos((current) => (current.includes(module) ? current.filter((m) => m !== module) : [...current, module]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createPlan.mutateAsync({
        nome,
        ...(descricao ? { descricao } : {}),
        preco: Number(preco),
        recorrencia,
        modulos,
        limites: {},
        iaIncluida,
        apiOficial,
      });
      onDone();
    } catch {
      // erro exibido abaixo
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createPlan.error && <Alert tone="error">{t("master.plans.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("master.plans.name")} required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Field label={t("master.plans.description")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Field label={t("master.plans.price")} type="number" min="0" step="0.01" required value={preco} onChange={(e) => setPreco(e.target.value)} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("master.plans.recurrence")}</label>
          <select
            value={recorrencia}
            onChange={(e) => setRecorrencia(e.target.value as "mensal" | "anual")}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="mensal">{t("master.plans.recurrence.mensal")}</option>
            <option value="anual">{t("master.plans.recurrence.anual")}</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ink">{t("master.plans.modules")}</label>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_MODULES.map((module) => (
            <button
              key={module}
              type="button"
              onClick={() => toggleModule(module)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                modulos.includes(module) ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint"
              }`}
            >
              {module}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={iaIncluida} onChange={(e) => setIaIncluida(e.target.checked)} />
          {t("master.plans.aiIncluded")}
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="checkbox" checked={apiOficial} onChange={(e) => setApiOficial(e.target.checked)} />
          {t("master.plans.officialApi")}
        </label>
      </div>
      <div>
        <Button type="submit" loading={createPlan.isPending}>
          {t("master.plans.create")}
        </Button>
      </div>
    </form>
  );
}
