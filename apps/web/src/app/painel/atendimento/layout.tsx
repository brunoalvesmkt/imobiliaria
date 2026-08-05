"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const TABS: { labelKey: DictionaryKey; href: string }[] = [
  { labelKey: "atendimento.tabs.inbox", href: "/painel/atendimento/inbox" },
  { labelKey: "atendimento.tabs.teams", href: "/painel/atendimento/equipes" },
];

const SETTINGS_ITEMS: { labelKey: DictionaryKey; href: string }[] = [
  { labelKey: "atendimento.quickMessages.title", href: "/painel/atendimento/mensagens-rapidas" },
];

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">{t("atendimento.title")}</h1>
          <DropdownMenu
            label={t("atendimento.settings")}
            items={SETTINGS_ITEMS.map((item) => ({ label: t(item.labelKey), onClick: () => router.push(item.href) }))}
            align="right"
          />
        </div>
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
