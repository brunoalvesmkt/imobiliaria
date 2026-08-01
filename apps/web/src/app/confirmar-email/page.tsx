"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n";
import { useCurrentUser, useTenantInfo, useLogout } from "@/lib/auth";
import { useConfirmEmailCode, useResendEmailConfirmationCode } from "@/lib/email-confirmation";
import { ApiError } from "@/lib/api-client";

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

const RESEND_COOLDOWN_S = 30;

/**
 * Tela de confirmação do e-mail do cadastro (documento de alterações,
 * item 4.2) — chega aqui via redirect do `middleware.ts` quando
 * `emailConfirmed: false`. Não está sob `/painel`, então não é bloqueada
 * pelo próprio guard que ela existe para resolver.
 */
export default function ConfirmarEmailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const tenant = useTenantInfo(currentUser.isSuccess);
  const confirm = useConfirmEmailCode();
  const resend = useResendEmailConfirmationCode();
  const logout = useLogout();

  const [codigo, setCodigo] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser.isError) router.replace("/login");
  }, [currentUser.isError, router]);

  useEffect(() => {
    if (tenant.data && tenant.data.emailConfirmado) router.replace("/painel");
  }, [tenant.data, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function onConfirm(e: React.FormEvent) {
    e.preventDefault();
    try {
      await confirm.mutateAsync(codigo);
      router.push("/painel");
    } catch {
      // erro exibido via confirm.error
    }
  }

  async function onResend() {
    setResendMessage(null);
    try {
      await resend.mutateAsync();
      setResendCooldown(RESEND_COOLDOWN_S);
      setResendMessage(t("emailConfirmation.resendSuccess"));
    } catch {
      // erro exibido via resend.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && error.status === 400) return error.message;
    return t("emailConfirmation.errorGeneric");
  }

  if (currentUser.isLoading || !tenant.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <span className="text-sm text-ink-faint">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <AuthCard title={t("emailConfirmation.title")} subtitle={t("emailConfirmation.subtitle").replace("{email}", maskEmail(tenant.data.email))}>
      <form className="flex flex-col gap-4" onSubmit={onConfirm}>
        {confirm.error && <Alert tone="error">{errorMessage(confirm.error)}</Alert>}
        {resend.error && <Alert tone="error">{errorMessage(resend.error)}</Alert>}
        {resendMessage && <Alert tone="success">{resendMessage}</Alert>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="codigo" className="text-sm font-medium text-ink">
            {t("emailConfirmation.codeLabel")}
          </label>
          <input
            id="codigo"
            name="codigo"
            inputMode="numeric"
            maxLength={6}
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className="rounded-md border border-line bg-surface px-3 py-2 text-center text-lg tracking-[0.4em] text-ink focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
            placeholder="000000"
          />
          <p className="text-xs text-ink-faint">{t("emailConfirmation.codeValidity")}</p>
        </div>

        <Button type="submit" loading={confirm.isPending} disabled={codigo.length !== 6} className="w-full">
          {t("emailConfirmation.confirm")}
        </Button>

        <Button type="button" variant="secondary" loading={resend.isPending} disabled={resendCooldown > 0} onClick={onResend} className="w-full">
          {resendCooldown > 0 ? t("emailConfirmation.resendCooldown").replace("{s}", String(resendCooldown)) : t("emailConfirmation.resend")}
        </Button>

        <button
          type="button"
          onClick={async () => {
            await logout.mutateAsync();
            router.push("/login");
          }}
          className="text-center text-sm text-ink-dim hover:underline"
        >
          {t("topbar.signOut")}
        </button>
      </form>
    </AuthCard>
  );
}
