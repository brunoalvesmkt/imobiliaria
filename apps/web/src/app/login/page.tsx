"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useLogin, useVerifyTwoFactor } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { loginSchema } from "@chatbot-saas/validation";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const login = useLogin();
  const verifyTwoFactor = useVerifyTwoFactor();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    const parsed = loginSchema.safeParse({ email, senha });
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? t("auth.login.errorGeneric"));
      return;
    }

    try {
      const result = await login.mutateAsync({ email, senha });
      if (result.status === "2fa_required") {
        setNeedsTwoFactor(true);
        return;
      }
      router.push("/painel");
    } catch {
      // erro já fica disponível via login.error, renderizado abaixo
    }
  }

  async function onVerifyTwoFactor(e: React.FormEvent) {
    e.preventDefault();
    try {
      await verifyTwoFactor.mutateAsync(codigo);
      router.push("/painel");
    } catch {
      // erro exibido via verifyTwoFactor.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 423) return error.message;
      if (error.status === 401) return t("auth.login.errorInvalid");
    }
    return t("auth.login.errorGeneric");
  }

  if (needsTwoFactor) {
    return (
      <AuthCard title={t("auth.login.twoFactorTitle")} subtitle={t("auth.login.twoFactorSubtitle")}>
        <form className="flex flex-col gap-4" onSubmit={onVerifyTwoFactor}>
          {verifyTwoFactor.error && <Alert tone="error">{errorMessage(verifyTwoFactor.error)}</Alert>}
          <Field
            label={t("emailConfirmation.codeLabel")}
            name="codigo"
            inputMode="numeric"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
          <Button type="submit" loading={verifyTwoFactor.isPending} disabled={codigo.length !== 6} className="w-full">
            {t("emailConfirmation.confirm")}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.noAccount")} <AuthLink href="/planos">{t("auth.login.signupLink")}</AuthLink>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {clientError && <Alert tone="error">{clientError}</Alert>}
        {!clientError && login.error && <Alert tone="error">{errorMessage(login.error)}</Alert>}

        <Field
          label={t("auth.login.email")}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t("auth.login.password")}
          type="password"
          name="senha"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <div className="flex justify-end">
          <AuthLink href="/esqueci-senha">{t("auth.login.forgotPassword")}</AuthLink>
        </div>

        <Button type="submit" loading={login.isPending} className="w-full">
          {t("auth.login.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
