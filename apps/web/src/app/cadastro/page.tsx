"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useSignup } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { signupTenantSchema } from "@chatbot-saas/validation";

export default function CadastroPage() {
  return (
    <Suspense>
      <CadastroForm />
    </Suspense>
  );
}

function CadastroForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const affiliateLinkCode = searchParams.get("ref") ?? undefined;
  const signup = useSignup();
  const [clientError, setClientError] = useState<string | null>(null);

  const [form, setForm] = useState({
    razaoSocial: "",
    cnpj: "",
    responsavel: "",
    email: "",
    confirmacaoEmail: "",
    senha: "",
    confirmacaoSenha: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    const parsed = signupTenantSchema.safeParse({ ...form, cnpj: form.cnpj.replace(/\D/g, "") });
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? t("auth.signup.errorGeneric"));
      return;
    }

    try {
      await signup.mutateAsync({
        ...form,
        cnpj: form.cnpj.replace(/\D/g, ""),
        ...(affiliateLinkCode ? { affiliateLinkCode } : {}),
      });
      router.push("/painel");
    } catch {
      // erro exibido via signup.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && (error.status === 409 || error.status === 400)) return error.message;
    return t("auth.signup.errorGeneric");
  }

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
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {clientError && <Alert tone="error">{clientError}</Alert>}
        {!clientError && signup.error && <Alert tone="error">{errorMessage(signup.error)}</Alert>}

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
        <Field
          label={t("auth.signup.email")}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <Field
          label={t("auth.signup.confirmEmail")}
          type="email"
          name="confirmacaoEmail"
          onPaste={(e) => e.preventDefault()}
          required
          value={form.confirmacaoEmail}
          onChange={(e) => set("confirmacaoEmail", e.target.value)}
        />
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

        <Button type="submit" loading={signup.isPending} className="w-full">
          {t("auth.signup.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
