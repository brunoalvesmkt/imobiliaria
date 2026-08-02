"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, applyModuleOrder } from "./nav-items";
import { useI18n } from "@/lib/i18n";
import { useTenantBranding } from "@/lib/branding";
import { LogoImage } from "./logo-image";

/** Mesmo NAV_ITEMS/lógica de ativo-desabilitado do Sidebar, só que como barra horizontal — layout alternativo ao menu lateral (documento de alterações: preferência de layout do menu). */
export function HorizontalNav({ activeModules, moduleOrder }: { activeModules: Set<string>; moduleOrder?: string[] | undefined }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = applyModuleOrder(NAV_ITEMS, moduleOrder);
  const branding = useTenantBranding();

  return (
    <nav className="flex flex-none items-center gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2 sm:px-6">
      <div className="mr-2 flex-none">
        <LogoImage
          lightUrl={branding.data?.logoLightUrl}
          darkUrl={branding.data?.logoDarkUrl}
          sizePercent={branding.data?.sizePercent}
          fallbackLetter="C"
          fallbackClassName="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white"
        />
      </div>
      <div className="flex flex-1 items-center justify-center gap-1">
        {items
          .filter((item) => !item.module || activeModules.has(item.module))
          .map((item) => {
            const isActive = item.href === "/painel" ? pathname === item.href : pathname?.startsWith(item.href);
            const isDisabled = !item.builtInPhase;

            if (isDisabled) {
              return (
                <span
                  key={item.href}
                  title={t("nav.comingSoonTitle")}
                  className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-ink-faint"
                >
                  {t(item.labelKey)}
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    {t("nav.comingSoon")}
                  </span>
                </span>
              );
            }

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
      </div>
    </nav>
  );
}
