"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useMyProfile, useLogout } from "@/lib/auth";
import { useChangeOwnPassword, useSetTwoFactor } from "@/lib/security";
import { Field } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";

type Tab = "senha" | "2fa";

/** Segurança — menu do avatar (documento de alterações, seção 8). */
export default function SegurancaPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("senha");

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("security.title")}</h1>
      </div>

      <div className="flex gap-1 border-b border-line">
        <TabButton active={tab === "senha"} onClick={() => setTab("senha")} label={t("security.tabPassword")} />
        <TabButton active={tab === "2fa"} onClick={() => setTab("2fa")} label={t("security.tabTwoFactor")} />
      </div>

      {tab === "senha" ? <PasswordTab /> : <TwoFactorTab />}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active ? "border-brand-500 text-ink" : "border-transparent text-ink-dim hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function PasswordTab() {
  const { t } = useI18n();
  const router = useRouter();
  const change = useChangeOwnPassword();
  const logout = useLogout();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (novaSenha !== confirmarNovaSenha) {
      setClientError(t("security.password.mismatch"));
      return;
    }

    try {
      await change.mutateAsync({ senhaAtual, novaSenha });
      setSuccess(true);
      // A troca revoga todas as sessões (inclusive a atual) — ver tenant-users.service.ts.
      await logout.mutateAsync();
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      // erro exibido via change.error
    }
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError && (error.status === 401 || error.status === 400)) return error.message;
    return t("security.errorGeneric");
  }

  if (success) {
    return <Alert tone="success">{t("security.password.success")}</Alert>;
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {clientError && <Alert tone="error">{clientError}</Alert>}
      {!clientError && change.error && <Alert tone="error">{errorMessage(change.error)}</Alert>}

      <Field
        label={t("security.password.current")}
        type="password"
        name="senhaAtual"
        autoComplete="current-password"
        required
        value={senhaAtual}
        onChange={(e) => setSenhaAtual(e.target.value)}
      />
      <Field
        label={t("security.password.new")}
        type="password"
        name="novaSenha"
        autoComplete="new-password"
        minLength={10}
        required
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
      />
      <Field
        label={t("security.password.confirmNew")}
        type="password"
        name="confirmarNovaSenha"
        autoComplete="new-password"
        required
        value={confirmarNovaSenha}
        onChange={(e) => setConfirmarNovaSenha(e.target.value)}
      />
      <Button type="submit" loading={change.isPending} className="w-fit">
        {t("security.password.submit")}
      </Button>
    </form>
  );
}

function TwoFactorTab() {
  const { t } = useI18n();
  const profile = useMyProfile(true);
  const setTwoFactor = useSetTwoFactor();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">{t("security.twoFactor.description")}</p>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={profile.data?.twoFactorEnabled ?? false}
          disabled={profile.isLoading || setTwoFactor.isPending}
          onChange={(e) => setTwoFactor.mutate(e.target.checked)}
        />
        {t("security.twoFactor.enable")}
      </label>
      {setTwoFactor.isError && <Alert tone="error">{t("security.errorGeneric")}</Alert>}
    </div>
  );
}
