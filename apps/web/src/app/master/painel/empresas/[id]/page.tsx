"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useImpersonateTenant,
  useMasterTenant,
  useResendTenantPasswordReset,
  useTenantConsumption,
  useTenantLoginAccess,
  useUpdateTenantLoginEmail,
  useUpdateTenantModule,
  useUpdateTenantPlan,
  useUpdateTenantStatus,
  type TenantStatus,
} from "@/lib/master-tenants";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/input";
import { useMasterPlans } from "@/lib/master-plans";
import { useCurrentMasterUser } from "@/lib/master-auth";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { StatusBadge } from "../status-badge";
import { formatCpfCnpj } from "@/lib/cpf-cnpj";

const STATUSES: TenantStatus[] = ["trial", "active", "suspended", "blocked", "cancelled"];
const MODULES = ["crm", "whatsapp", "atendimento", "chatbot", "automacao", "qualidade_ia"];

export default function MasterTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { t } = useI18n();
  const currentUser = useCurrentMasterUser();
  const role = currentUser.data?.masterRole;
  const canManage = role === "super_admin";
  const canAssignPlan = role === "super_admin" || role === "financeiro";
  const canImpersonate = role === "super_admin" || role === "suporte";
  const tenant = useMasterTenant(id);
  const consumption = useTenantConsumption(id);
  const plans = useMasterPlans();
  const updateStatus = useUpdateTenantStatus(id);
  const updatePlan = useUpdateTenantPlan(id);
  const updateModule = useUpdateTenantModule(id);
  const impersonate = useImpersonateTenant(id);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const loginAccess = useTenantLoginAccess(id);
  const updateLoginEmail = useUpdateTenantLoginEmail(id);
  const resendPasswordReset = useResendTenantPasswordReset(id);
  const [loginEmail, setLoginEmail] = useState("");
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  useEffect(() => {
    if (loginAccess.data?.email) setLoginEmail(loginAccess.data.email);
  }, [loginAccess.data?.email]);

  if (tenant.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (!tenant.data) return null;
  const data = tenant.data;

  function saveLoginEmail() {
    if (loginEmail.trim() && loginEmail.trim() !== loginAccess.data?.email) {
      updateLoginEmail.mutate(loginEmail.trim());
    }
  }

  async function onResendPasswordReset() {
    setPasswordResetSent(false);
    await resendPasswordReset.mutateAsync();
    setPasswordResetSent(true);
  }

  async function onImpersonate(accessLevel: "read" | "read_write") {
    setImpersonateError(null);
    try {
      await impersonate.mutateAsync(accessLevel);
      window.location.href = "/painel";
    } catch {
      setImpersonateError(t("master.tenants.impersonate.errorGeneric"));
    }
  }

  const flagsByModule = new Map(data.featureFlags.map((f) => [f.module, f.enabled]));
  const iaFlag = data.featureFlags.find((f) => f.module === "ia");
  const iaEnabled = iaFlag?.enabled ?? false;
  const iaConfig = (iaFlag?.config ?? {}) as { allowByok?: boolean; allowPlatformKey?: boolean };

  function toggleIaConfig(patch: Partial<{ allowByok: boolean; allowPlatformKey: boolean }>) {
    updateModule.mutate({
      module: "ia",
      enabled: true,
      config: { allowByok: iaConfig.allowByok ?? false, allowPlatformKey: iaConfig.allowPlatformKey ?? false, ...patch },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/master/painel/empresas" className="text-xs font-medium text-ink-dim hover:text-ink">
        ← {t("master.tenants.back")}
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">{data.razaoSocial}</h1>
        <StatusBadge status={data.status} />
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.contactInfo")}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink-faint">{t("master.tenants.columnCnpj")}</dt>
            <dd className="text-ink">{formatCpfCnpj(data.cnpj)}</dd>
            <dt className="text-ink-faint">{t("master.tenants.responsible")}</dt>
            <dd className="text-ink">{data.responsavel}</dd>
            <dt className="text-ink-faint">E-mail</dt>
            <dd className="text-ink">{data.email}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.consumption")}</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-ink-faint">{t("master.tenants.consumptionUsers")}</dt>
            <dd className="text-ink">{consumption.data?.tenantUsers ?? "—"}</dd>
            <dt className="text-ink-faint">{t("master.tenants.consumptionFiles")}</dt>
            <dd className="text-ink">{consumption.data?.files ?? "—"}</dd>
          </dl>
        </div>
      </section>

      {canManage && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.loginAccess.title")}</h2>
          <p className="mt-1 text-xs text-ink-faint">{t("master.tenants.loginAccess.subtitle")}</p>

          {loginAccess.isLoading && <p className="mt-2 text-sm text-ink-faint">{t("common.loading")}</p>}

          {!loginAccess.isLoading && !loginAccess.data?.id && (
            <p className="mt-2 text-sm text-ink-faint">{t("master.tenants.loginAccess.notFound")}</p>
          )}

          {!!loginAccess.data?.id && (
            <div className="mt-2 flex flex-col gap-3">
              {updateLoginEmail.isError && <Alert tone="error">{t("master.tenants.loginAccess.emailError")}</Alert>}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1">
                  <Field
                    label={t("master.tenants.loginAccess.email")}
                    name="loginEmail"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveLoginEmail}
                  disabled={updateLoginEmail.isPending || !loginEmail.trim() || loginEmail.trim() === loginAccess.data?.email}
                  className="rounded-md bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {t("master.tenants.loginAccess.saveEmail")}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onResendPasswordReset}
                  disabled={resendPasswordReset.isPending}
                  className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-alt disabled:opacity-40"
                >
                  {t("master.tenants.loginAccess.resendReset")}
                </button>
                {passwordResetSent && <span className="text-xs text-emerald-600 dark:text-emerald-400">{t("master.tenants.loginAccess.resendSent")}</span>}
                {resendPasswordReset.isError && <span className="text-xs text-red-600">{t("master.tenants.loginAccess.resendError")}</span>}
              </div>
            </div>
          )}
        </section>
      )}

      {canManage && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.changeStatus")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={status === data.status}
                onClick={() => updateStatus.mutate(status)}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-alt disabled:opacity-40"
              >
                {t(`master.tenants.status.${status}` as DictionaryKey)}
              </button>
            ))}
          </div>
        </section>
      )}

      {canAssignPlan && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.changePlan")}</h2>
          <select
            value={data.planId ?? ""}
            onChange={(e) => e.target.value && updatePlan.mutate(e.target.value)}
            className="mt-2 rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="" disabled>
              {t("master.tenants.noPlan")}
            </option>
            {plans.data?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.nome}
              </option>
            ))}
          </select>
        </section>
      )}

      {canManage && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.modules")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {MODULES.map((module) => {
              const enabled = flagsByModule.get(module) ?? false;
              return (
                <button
                  key={module}
                  type="button"
                  onClick={() => updateModule.mutate({ module, enabled: !enabled })}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    enabled ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint"
                  }`}
                >
                  {module} {enabled ? "✓" : ""}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {canImpersonate && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">{t("master.tenants.impersonate.title")}</h2>
          <p className="mt-1 text-xs text-ink-faint">{t("master.tenants.impersonate.description")}</p>
          {impersonateError && (
            <div className="mt-2">
              <Alert tone="error">{impersonateError}</Alert>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onImpersonate("read")}
              disabled={impersonate.isPending}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-alt disabled:opacity-40"
            >
              {t("master.tenants.impersonate.read")}
            </button>
            {role === "super_admin" && (
              <button
                type="button"
                onClick={() => onImpersonate("read_write")}
                disabled={impersonate.isPending}
                className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-dim hover:bg-surface-alt disabled:opacity-40"
              >
                {t("master.tenants.impersonate.readWrite")}
              </button>
            )}
          </div>
        </section>
      )}

      {canManage && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t("master.tenants.ia.title")}</h2>
            <button
              type="button"
              onClick={() => updateModule.mutate({ module: "ia", enabled: !iaEnabled, config: iaConfig })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                iaEnabled ? "bg-brand-50 text-brand-700" : "bg-surface-muted text-ink-faint"
              }`}
            >
              {iaEnabled ? t("master.tenants.ia.enabled") : t("master.tenants.ia.disabled")}
            </button>
          </div>

          {iaEnabled && (
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                <input
                  type="checkbox"
                  checked={iaConfig.allowByok ?? false}
                  onChange={(e) => toggleIaConfig({ allowByok: e.target.checked })}
                />
                {t("master.tenants.ia.allowByok")}
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-dim">
                <input
                  type="checkbox"
                  checked={iaConfig.allowPlatformKey ?? false}
                  onChange={(e) => toggleIaConfig({ allowPlatformKey: e.target.checked })}
                />
                {t("master.tenants.ia.allowPlatformKey")}
              </label>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
