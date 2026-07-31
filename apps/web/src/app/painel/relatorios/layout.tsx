"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const TABS: { labelKey: DictionaryKey; href: string }[] = [
  { labelKey: "relatorios.tabs.crm", href: "/painel/relatorios/crm" },
  { labelKey: "relatorios.tabs.whatsapp", href: "/painel/relatorios/whatsapp" },
  { labelKey: "relatorios.tabs.atendimento", href: "/painel/relatorios/atendimento" },
  { labelKey: "relatorios.tabs.chatbot", href: "/painel/relatorios/chatbot" },
  { labelKey: "relatorios.tabs.automacao", href: "/painel/relatorios/automacao" },
  { labelKey: "relatorios.tabs.financeiro", href: "/painel/relatorios/financeiro" },
  { labelKey: "relatorios.tabs.qualidade", href: "/painel/relatorios/qualidade" },
];

export default function RelatoriosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("relatorios.title")}</h1>
        <nav className="mt-3 flex flex-wrap gap-1 border-b border-line">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
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
