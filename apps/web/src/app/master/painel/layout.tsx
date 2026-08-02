"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentMasterUser, useMasterLogout } from "@/lib/master-auth";
import { keepSessionAlive } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { useMenuLayout } from "@/lib/menu-layout";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MenuLayoutToggle } from "@/components/layout/menu-layout-toggle";

const NAV_ITEMS: { labelKey: DictionaryKey; href: string; roles?: ("super_admin" | "financeiro" | "suporte")[] }[] = [
  { labelKey: "master.nav.empresas", href: "/master/painel/empresas" },
  { labelKey: "master.nav.planos", href: "/master/painel/planos" },
  { labelKey: "master.nav.afiliados", href: "/master/painel/afiliados", roles: ["super_admin", "financeiro"] },
  { labelKey: "master.nav.ia", href: "/master/painel/ia", roles: ["super_admin"] },
  { labelKey: "master.nav.usuarios", href: "/master/painel/usuarios", roles: ["super_admin"] },
  { labelKey: "master.nav.configuracoesEmpresas", href: "/master/painel/configuracoes-empresas", roles: ["super_admin"] },
  { labelKey: "auditLog.title", href: "/master/painel/auditoria", roles: ["super_admin"] },
];

/**
 * Guard client-side, mesmo padrão do painel do tenant (`app/painel/layout.tsx`)
 * — os cookies `master_access_token`/`master_refresh_token` são distintos dos
 * cookies do tenant, então as duas sessões coexistem no mesmo navegador sem
 * conflito, mas cada shell precisa do seu próprio guard.
 */
export default function MasterPainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const currentUser = useCurrentMasterUser();
  const logout = useMasterLogout();
  const { layout } = useMenuLayout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (currentUser.isError) {
      router.replace("/master/login");
    }
  }, [currentUser.isError, router]);

  /** Mesmo raciocínio do painel do tenant: renova a sessão periodicamente enquanto a aba fica aberta, sem esperar por uma navegação/401. */
  useEffect(() => {
    if (!currentUser.isSuccess) return;
    const interval = setInterval(() => keepSessionAlive("master"), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser.isSuccess]);

  async function onLogout() {
    await logout.mutateAsync();
    router.push("/master/login");
  }

  if (currentUser.isLoading || currentUser.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <span className="text-sm text-ink-faint">{t("common.loading")}</span>
      </div>
    );
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(currentUser.data!.masterRole));

  const header = (
    <header className="flex h-14 flex-none items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {layout === "vertical" && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("topbar.openMenu")}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <span className="truncate text-sm font-medium text-ink">{t("master.brand")}</span>
      </div>
      <div className="flex items-center gap-2">
        <MenuLayoutToggle />
        <LanguageSwitcher />
        <ThemeToggle />
        <button type="button" onClick={onLogout} className="rounded-md px-2 py-1.5 text-sm text-ink-dim hover:bg-surface-alt">
          {t("topbar.signOut")}
        </button>
      </div>
    </header>
  );

  if (layout === "horizontal") {
    return (
      <div className="flex min-h-screen flex-col bg-surface-alt">
        {header}
        <nav className="flex flex-none gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2 sm:px-6">
          {visibleItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-none whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-ink-dim hover:bg-surface-alt hover:text-ink"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface-alt">
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-none flex-col gap-1 border-r border-line bg-surface p-4 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-sm font-bold text-surface">M</span>
          <span className="text-sm font-semibold text-ink">{t("master.brand")}</span>
        </div>
        {visibleItems.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-ink-dim hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
