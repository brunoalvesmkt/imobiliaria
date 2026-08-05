"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { AuthLink } from "@/components/auth/auth-card";
import { LogoImage } from "@/components/layout/logo-image";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useSiteBranding } from "@/lib/branding";
import { usePublicPlans, usePublicSettings, planFeatureList, type PublicPlan } from "@/lib/public-catalog";

/**
 * Página pública "Escolha seu plano" (documento de alterações, seção 2) —
 * primeiro passo do fluxo de contratação, antes do formulário de cadastro.
 * Não exige sessão; lista só planos `ativo && publicoAtivo`.
 */
export default function PlanosPage() {
  return (
    <Suspense>
      <PlanosContent />
    </Suspense>
  );
}

function PlanosContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const affiliateLinkCode = searchParams.get("ref") ?? undefined;
  const plans = usePublicPlans();
  const settings = usePublicSettings();
  const branding = useSiteBranding();
  const [periodicidade, setPeriodicidade] = useState<"mensal" | "anual">("mensal");

  const allowMonthly = settings.data?.allowMonthly !== false;
  const allowAnnual = settings.data?.allowAnnual !== false;
  const hasAnualPlans = (plans.data ?? []).some((p) => p.precoAnual !== null);
  const showToggle = allowMonthly && allowAnnual && hasAnualPlans;
  const showPrices = settings.data?.showPrices !== false;
  const showTrialPeriod = settings.data?.showTrialPeriod !== false;
  const buttonText = settings.data?.subscribeButtonText || t("publicPlans.subscribe");

  useEffect(() => {
    if (!allowMonthly && periodicidade === "mensal") setPeriodicidade("anual");
    if (!allowAnnual && periodicidade === "anual") setPeriodicidade("mensal");
  }, [allowMonthly, allowAnnual, periodicidade]);

  function escolherPlano(plan: PublicPlan) {
    const params = new URLSearchParams({ planId: plan.id, periodicidade, ...(affiliateLinkCode ? { ref: affiliateLinkCode } : {}) });
    router.push(`/cadastro?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-surface-alt">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <LogoImage
            lightUrl={branding.data?.tenantLoginLogo.logoLightUrl}
            darkUrl={branding.data?.tenantLoginLogo.logoDarkUrl}
            sizePercent={branding.data?.tenantLoginLogo.sizePercent}
            fallbackLetter="C"
            fallbackClassName="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white"
          />
          <span className="text-sm font-semibold text-ink">{branding.data?.browserTitle || t("nav.brand")}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <AuthLink href="/login">{t("auth.login.title")}</AuthLink>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">{t("publicPlans.title")}</h1>
          <p className="mt-2 text-sm text-ink-dim">{t("publicPlans.subtitle")}</p>
        </div>

        {showToggle && (
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-md border border-line bg-surface p-1">
              <button
                type="button"
                onClick={() => setPeriodicidade("mensal")}
                className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                  periodicidade === "mensal" ? "bg-brand-500 text-white" : "text-ink-dim hover:text-ink"
                }`}
              >
                {t("publicPlans.mensal")}
              </button>
              <button
                type="button"
                onClick={() => setPeriodicidade("anual")}
                className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                  periodicidade === "anual" ? "bg-brand-500 text-white" : "text-ink-dim hover:text-ink"
                }`}
              >
                {t("publicPlans.anual")}
              </button>
            </div>
          </div>
        )}

        {settings.data?.planSelectionEnabled === false && <p className="text-center text-sm text-ink-dim">{t("publicPlans.disabled")}</p>}
        {settings.data?.planSelectionEnabled !== false && (
          <>
            {plans.isLoading && <p className="text-center text-sm text-ink-dim">{t("publicPlans.loading")}</p>}
            {plans.isError && <p className="text-center text-sm text-red-600">{t("publicPlans.error")}</p>}
            {plans.data && plans.data.length === 0 && <p className="text-center text-sm text-ink-dim">{t("publicPlans.empty")}</p>}

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.data?.map((plan) => {
            const preco = periodicidade === "anual" && plan.precoAnual !== null ? plan.precoAnual : plan.preco;
            const features = planFeatureList(plan.funcionalidades);
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-lg border bg-surface p-6 shadow-sm ${
                  plan.destaque ? "border-brand-400 ring-1 ring-brand-400" : "border-line"
                }`}
              >
                {plan.destaque && (
                  <span className="mb-3 inline-block w-fit rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                    {t("publicPlans.destaque")}
                  </span>
                )}
                <h2 className="text-lg font-semibold text-ink">{plan.nome}</h2>
                {plan.descricao && <p className="mt-1 text-sm text-ink-dim">{plan.descricao}</p>}
                {showPrices && (
                  <p className="mt-4 text-3xl font-bold text-ink">
                    R$ {Number(preco).toFixed(2)}
                    <span className="text-sm font-normal text-ink-dim">
                      /{periodicidade === "anual" ? t("publicPlans.ano") : t("publicPlans.mes")}
                    </span>
                  </p>
                )}
                {showTrialPeriod && plan.diasTeste > 0 && (
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-300">{t("publicPlans.trial").replace("{dias}", String(plan.diasTeste))}</p>
                )}
                {features.length > 0 && (
                  <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-ink-dim">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span aria-hidden className="mt-0.5 text-brand-500">
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <Button className="mt-6 w-full" onClick={() => escolherPlano(plan)}>
                  {buttonText}
                </Button>
              </div>
            );
          })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
