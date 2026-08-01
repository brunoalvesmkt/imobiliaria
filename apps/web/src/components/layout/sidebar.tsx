"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { useI18n } from "@/lib/i18n";

/** Aplica a ordem definida pelo Master (chaves de NavItem.key); itens não listados mantêm a ordem original, ao final. "Início" nunca é reordenado. */
function applyModuleOrder(items: NavItem[], moduleOrder: string[] | undefined): NavItem[] {
  if (!moduleOrder || moduleOrder.length === 0) return items;
  const [first, ...rest] = items;
  const byKey = new Map(rest.map((item) => [item.key, item]));
  const ordered = moduleOrder.map((key) => byKey.get(key)).filter((item): item is NavItem => !!item);
  const remaining = rest.filter((item) => !moduleOrder.includes(item.key));
  return first ? [first, ...ordered, ...remaining] : [...ordered, ...remaining];
}

export function Sidebar({
  activeModules,
  moduleOrder,
  open,
  onClose,
}: {
  activeModules: Set<string>;
  moduleOrder?: string[] | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const items = applyModuleOrder(NAV_ITEMS, moduleOrder);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />}
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-none flex-col gap-1 border-r border-line bg-surface p-4 transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-sm font-bold text-white">C</span>
          <span className="text-sm font-semibold text-ink">{t("nav.brand")}</span>
        </div>

        {items.filter((item) => !item.module || activeModules.has(item.module)).map((item) => {
          const isActive = item.href === "/painel" ? pathname === item.href : pathname?.startsWith(item.href);
          const isDisabled = !item.builtInPhase;

          if (isDisabled) {
            return (
              <span
                key={item.href}
                title={t("nav.comingSoonTitle")}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-faint"
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
              onClick={onClose}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-ink-dim hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
