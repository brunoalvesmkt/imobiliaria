"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useSignup } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { usePublicPlans, usePublicSegments, usePublicSettings } from "@/lib/public-catalog";
import { signupTenantSchema } from "@chatbot-saas/validation";

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroForm />
    </Suspense>
  );
}

type Step = "empresa" | "conta";

const EMPTY_FORM = {
  razaoSocial: "",
  cnpj: "",
  responsavel: "",
  telefone: "",
  whatsapp: "",
  segmentoId: "",
  endereco: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  email: "",
  confirmacaoEmail: "",
  senha: "",
  confirmacaoSenha: "",
};

function CadastroForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const affiliateLinkCode = searchParams.get("ref") ?? undefined;
  const planId = searchParams.get("planId");
  const periodicidade = (searchParams.get("periodicidade") === "anual" ? "anual" : "mensal") as "mensal" | "anual";

  const plans = usePublicPlans();
  const segments = usePublicSegments();
  const settings = usePublicSettings();
  const signup = useSignup();
  const requireEmailRepeat = settings.data?.emailConfirmRepeatEnabled !== false;

  const [step, setStep] = useState<Step>("empresa");
  const [clientError, setClientError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Sem plano escolhido não há como prosseguir — o backend também recusa
  // (documento de alterações, item 2.4: revalidação obrigatória do plano).
  useEffect(() => {
    if (!planId) router.replace(affiliateLinkCode ? `/planos?ref=${affiliateLinkCode}` : "/planos");
  }, [planId, affiliateLinkCode, router]);

  const selectedPlan = plans.data?.find((p) => p.id === planId);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function goToConta(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);
    setStep("conta");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!planId) return;

    const payload = { ...form, cnpj: form.cnpj.replace(/\D/g, ""), planId, periodicidade };
    const parsed = signupTenantSchema.safeParse(payload);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? t("auth.signup.errorGeneric"));
      return;
    }

    try {
      await signup.mutateAsync({
        ...payload,
        ...(affiliateLinkCode ? { affiliateLinkCode } : {}),
      });
      router.push("/painel");
    } catch {
      // erro exibido via signup.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && (error.status === 409 || error.status === 400 || error.status === 404)) return error.message;
    return t("auth.signup.errorGeneric");
  }

  if (!planId) return null;

  return (
    <AuthCard
      title={t("auth.signup.title")}
      subtitle={t("auth.signup.subtitle")}
      footer={
        <>
          {t("auth.signup.hasAccount")} <AuthLink href="/login">{t("auth.signup.loginLink")}</AuthLink>
        </>
      }
    >
      <div className="mb-4 flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm">
        <span className="text-ink-dim">
          {t("auth.signup.selectedPlan")}: <span className="font-medium text-ink">{selectedPlan?.nome ?? "…"}</span>
        </span>
        <AuthLink href="/planos">{t("auth.signup.changePlan")}</AuthLink>
      </div>

      <div className="mb-5 flex items-center gap-2 text-xs font-medium text-ink-dim">
        <StepDot active={step === "empresa"} done={step === "conta"} label={t("auth.signup.stepEmpresa")} />
        <span className="h-px flex-1 bg-line" />
        <StepDot active={step === "conta"} done={false} label={t("auth.signup.stepConta")} />
      </div>

      {clientError && <Alert tone="error">{clientError}</Alert>}
      {!clientError && signup.error && <Alert tone="error">{errorMessage(signup.error)}</Alert>}

      {step === "empresa" && (
        <form className="flex flex-col gap-4" onSubmit={goToConta}>
          <Field label={t("auth.signup.razaoSocial")} name="razaoSocial" required value={form.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
          <Field
            label={t("auth.signup.cnpj")}
            name="cnpj"
            placeholder={t("auth.signup.cnpjPlaceholder")}
            inputMode="numeric"
            required
            value={form.cnpj}
            onChange={(e) => set("cnpj", e.target.value)}
          />
          <Field label={t("auth.signup.responsavel")} name="responsavel" required value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t("auth.signup.telefone")}
              name="telefone"
              inputMode="tel"
              required
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
            />
            <Field
              label={t("auth.signup.whatsapp")}
              name="whatsapp"
              inputMode="tel"
              required
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="segmentoId" className="text-sm font-medium text-ink">
              {t("auth.signup.segmento")}
            </label>
            <select
              id="segmentoId"
              required
              value={form.segmentoId}
              onChange={(e) => set("segmentoId", e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
            >
              <option value="" disabled>
                {t("auth.signup.segmentoPlaceholder")}
              </option>
              {segments.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <Field label={t("auth.signup.endereco")} name="endereco" required value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
          <div className="grid grid-cols-[1fr_2fr] gap-4">
            <Field label={t("auth.signup.numero")} name="numero" required value={form.numero} onChange={(e) => set("numero", e.target.value)} />
            <Field label={t("auth.signup.bairro")} name="bairro" required value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
          </div>
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4">
            <Field label={t("auth.signup.cidade")} name="cidade" required value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
            <Field label={t("auth.signup.uf")} name="uf" maxLength={2} required value={form.uf} onChange={(e) => set("uf", e.target.value.toUpperCase())} />
            <Field
              label={t("auth.signup.cep")}
              name="cep"
              inputMode="numeric"
              placeholder="00000-000"
              required
              value={form.cep}
              onChange={(e) => set("cep", e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full">
            {t("auth.signup.nextStep")}
          </Button>
        </form>
      )}

      {step === "conta" && (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field
            label={t("auth.signup.email")}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({ ...prev, email: value, ...(requireEmailRepeat ? {} : { confirmacaoEmail: value }) }));
            }}
          />
          {requireEmailRepeat && (
            <Field
              label={t("auth.signup.confirmEmail")}
              type="email"
              name="confirmacaoEmail"
              onPaste={(e) => e.preventDefault()}
              required
              value={form.confirmacaoEmail}
              onChange={(e) => set("confirmacaoEmail", e.target.value)}
            />
          )}
          <Field
            label={t("auth.signup.password")}
            type="password"
            name="senha"
            autoComplete="new-password"
            minLength={10}
            required
            value={form.senha}
            onChange={(e) => set("senha", e.target.value)}
          />
          <Field
            label={t("auth.signup.confirmPassword")}
            type="password"
            name="confirmacaoSenha"
            autoComplete="new-password"
            onPaste={(e) => e.preventDefault()}
            required
            value={form.confirmacaoSenha}
            onChange={(e) => set("confirmacaoSenha", e.target.value)}
          />

          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep("empresa")}>
              {t("auth.signup.previousStep")}
            </Button>
            <Button type="submit" loading={signup.isPending} className="flex-1">
              {t("auth.signup.submit")}
            </Button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${active ? "text-brand-600 dark:text-brand-300" : done ? "text-ink-dim" : "text-ink-faint"}`}>
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
          active ? "bg-brand-500 text-white" : done ? "bg-brand-200 text-brand-800 dark:bg-brand-800 dark:text-brand-100" : "bg-surface-muted"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}
