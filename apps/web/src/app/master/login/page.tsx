"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useMasterLogin } from "@/lib/master-auth";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function MasterLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const login = useMasterLogin();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, senha });
      router.push("/master/painel");
    } catch {
      // erro já fica disponível via login.error, renderizado abaixo
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 401) return t("master.login.errorInvalid");
    return t("master.login.errorGeneric");
  }

  return (
    <AuthCard title={t("master.login.title")} subtitle={t("master.login.subtitle")} logoVariant="master">
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {login.error && <Alert tone="error">{errorMessage(login.error)}</Alert>}

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
