"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const TABS: { labelKey: DictionaryKey; href: string }[] = [
  { labelKey: "crm.tabs.contacts", href: "/painel/crm/contatos" },
  { labelKey: "crm.tabs.funnel", href: "/painel/crm/funil" },
  { labelKey: "crm.tabs.tasks", href: "/painel/crm/tarefas" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("crm.title")}</h1>
        <nav className="mt-3 flex gap-1 border-b border-line">
          {TABS.map((tab) => {
            const isActive = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-3 py-2 text-sm font-medium ${
                  isActive ? "border-brand-500 text-brand-700" : "border-transparent text-ink-dim hover:text-ink"
                }`}
              >
                {t(tab.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
