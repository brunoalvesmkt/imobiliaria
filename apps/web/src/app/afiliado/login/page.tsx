"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useAffiliateLogin } from "@/lib/affiliate-auth";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { loginSchema } from "@chatbot-saas/validation";

export default function AfiliadoLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const login = useAffiliateLogin();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
      await login.mutateAsync({ email, senha });
      router.push("/afiliado/painel");
    } catch {
      // erro já fica disponível via login.error, renderizado abaixo
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 401) return t("affiliate.login.errorInvalid");
    return t("auth.login.errorGeneric");
  }

  return (
    <AuthCard title={t("affiliate.login.title")} subtitle={t("affiliate.login.subtitle")}>
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

        <Button type="submit" loading={login.isPending} className="w-full">
          {t("auth.login.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
