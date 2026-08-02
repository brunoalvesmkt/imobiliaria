"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const TABS: { href: string; labelKey: DictionaryKey }[] = [
  { href: "/master/painel/configuracoes-empresas/plano", labelKey: "master.settings.planSelection.title" },
  { href: "/master/painel/configuracoes-empresas/cadastro", labelKey: "master.settings.emailConfirmation.title" },
  { href: "/master/painel/configuracoes-empresas/edicao", labelKey: "master.settings.tenantEditing.title" },
  { href: "/master/painel/configuracoes-empresas/termo-risco", labelKey: "master.settings.riskTerm.title" },
  { href: "/master/painel/configuracoes-empresas/modulos", labelKey: "master.settings.modules.title" },
  { href: "/master/painel/configuracoes-empresas/personalizacao", labelKey: "branding.title" },
];

export default function MasterConfiguracoesEmpresasLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">{t("master.settings.title")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("master.settings.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-2 text-sm font-medium ${
              pathname === tab.href ? "border-b-2 border-brand-600 text-ink" : "text-ink-faint hover:text-ink-dim"
            }`}
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
