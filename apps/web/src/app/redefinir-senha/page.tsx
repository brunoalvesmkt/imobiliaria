"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useConfirmPasswordReset } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const { t } = useI18n();
  const confirmReset = useConfirmPasswordReset();
  const [token, setToken] = useState("");
  const [novaSenha, setNovaSenha] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await confirmReset.mutateAsync({ token, novaSenha });
      router.push("/login");
    } catch {
      // erro exibido via confirmReset.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 400) return t("auth.resetPassword.errorInvalidToken");
    return t("auth.resetPassword.errorGeneric");
  }

  return (
    <AuthCard
      title={t("auth.resetPassword.title")}
      subtitle={t("auth.resetPassword.subtitle")}
      footer={<AuthLink href="/login">{t("auth.forgotPassword.backToLogin")}</AuthLink>}
    >
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {confirmReset.error && <Alert tone="error">{errorMessage(confirmReset.error)}</Alert>}

        <Field label={t("auth.resetPassword.token")} name="token" required value={token} onChange={(e) => setToken(e.target.value)} />
        <Field
          label={t("auth.resetPassword.newPassword")}
          type="password"
          name="novaSenha"
          autoComplete="new-password"
          minLength={10}
          required
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
        />

        <Button type="submit" loading={confirmReset.isPending} className="w-full">
          {t("auth.resetPassword.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
