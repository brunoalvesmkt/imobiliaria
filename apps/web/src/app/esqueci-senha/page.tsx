"use client";

import { useState } from "react";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useRequestPasswordReset } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function EsqueciSenhaPage() {
  const { t } = useI18n();
  const requestReset = useRequestPasswordReset();
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await requestReset.mutateAsync(email);
  }

  return (
    <AuthCard
      title={t("auth.forgotPassword.title")}
      subtitle={t("auth.forgotPassword.subtitle")}
      footer={<AuthLink href="/login">{t("auth.forgotPassword.backToLogin")}</AuthLink>}
    >
      {requestReset.isSuccess ? (
        <Alert tone="success">
          {t("auth.forgotPassword.successPart1")} <AuthLink href="/redefinir-senha">{t("auth.forgotPassword.successLink")}</AuthLink>.
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field
            label={t("auth.forgotPassword.email")}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={requestReset.isPending} className="w-full">
            {t("auth.forgotPassword.submit")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
