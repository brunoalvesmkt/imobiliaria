"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentAffiliate, useAffiliateLogout } from "@/lib/affiliate-auth";
import { keepSessionAlive } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

/**
 * Shell mínimo do painel de autoatendimento do afiliado (Fase 32, ver
 * DEVELOPMENT_PLAN.md) — sem sidebar de navegação porque só existe uma
 * tela (dashboard read-only); mesmo guard client-side já usado no painel
 * do tenant e do Master (cookies distintos, coexistem no mesmo navegador).
 */
export default function AfiliadoPainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const currentAffiliate = useCurrentAffiliate();
  const logout = useAffiliateLogout();

  useEffect(() => {
    if (currentAffiliate.isError) {
      router.replace("/afiliado/login");
    }
  }, [currentAffiliate.isError, router]);

  /** Mesmo raciocínio do painel do tenant: renova a sessão periodicamente enquanto a aba fica aberta, sem esperar por uma navegação/401. */
  useEffect(() => {
    if (!currentAffiliate.isSuccess) return;
    const interval = setInterval(() => keepSessionAlive("affiliate"), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentAffiliate.isSuccess]);

  async function onLogout() {
    await logout.mutateAsync();
    router.push("/afiliado/login");
  }

  if (currentAffiliate.isLoading || currentAffiliate.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <span className="text-sm text-ink-faint">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-alt">
      <header className="flex h-14 flex-none items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
        <span className="truncate text-sm font-medium text-ink">{t("affiliate.panel.brand")}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <button type="button" onClick={onLogout} className="rounded-md px-2 py-1.5 text-sm text-ink-dim hover:bg-surface-alt">
            {t("topbar.signOut")}
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
