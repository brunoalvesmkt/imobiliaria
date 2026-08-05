"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveModules, useCurrentUser, useModuleOrder } from "@/lib/auth";
import { keepSessionAlive } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n";
import { RealtimeProvider } from "@/lib/realtime";
import { useMenuLayout } from "@/lib/menu-layout";
import { Sidebar } from "@/components/layout/sidebar";
import { HorizontalNav } from "@/components/layout/horizontal-nav";
import { Topbar } from "@/components/layout/topbar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { AnnouncementBanner } from "@/components/layout/announcement-banner";

/**
 * Proteção de rota é feita no cliente (não há middleware/SSR autenticado
 * ainda — os cookies de sessão vivem no domínio da API, não no do Next.js,
 * ver DEVELOPMENT_PLAN.md nota da Fase F1). Isso significa um flash breve
 * de carregamento antes do redirect quando a sessão é inválida — aceitável
 * para esta fase; resolver com um proxy de cookies (Route Handlers) fica
 * para quando SSR autenticado for necessário.
 */
export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  const currentUser = useCurrentUser();
  const activeModules = useActiveModules(currentUser.isSuccess);
  const moduleOrder = useModuleOrder(currentUser.isSuccess);
  const { layout } = useMenuLayout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (currentUser.isError) {
      router.replace("/login");
    }
  }, [currentUser.isError, router]);

  /** Enquanto a aba do painel ficar aberta, renova a sessão de tempos em
   * tempos — sem isso, uma aba esquecida aberta e ociosa por mais tempo
   * que o access token só descobriria a expiração na próxima ação do
   * usuário. A sessão deve encerrar só no logout manual. */
  useEffect(() => {
    if (!currentUser.isSuccess) return;
    const interval = setInterval(() => keepSessionAlive("tenant"), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser.isSuccess]);

  if (currentUser.isLoading || currentUser.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt">
        <span className="text-sm text-ink-faint">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <RealtimeProvider enabled={currentUser.isSuccess}>
      <div className="flex h-screen flex-col overflow-hidden bg-surface-alt">
        {currentUser.data?.impersonation && <ImpersonationBanner impersonation={currentUser.data.impersonation} />}
        <AnnouncementBanner />
        {layout === "horizontal" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <HorizontalNav activeModules={activeModules.data ?? new Set()} moduleOrder={moduleOrder.data} />
            <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <Sidebar
              activeModules={activeModules.data ?? new Set()}
              moduleOrder={moduleOrder.data}
              open={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="md:hidden">
                <Topbar onMenuClick={() => setSidebarOpen(true)} />
              </div>
              <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
            </div>
          </div>
        )}
      </div>
    </RealtimeProvider>
  );
}
