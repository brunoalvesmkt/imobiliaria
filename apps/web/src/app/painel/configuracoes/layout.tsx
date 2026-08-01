"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

const TABS: { href: string; labelKey: DictionaryKey }[] = [
  { href: "/painel/configuracoes/usuarios", labelKey: "tenantUsers.title" },
  { href: "/painel/configuracoes/perfis", labelKey: "roles.title" },
  { href: "/painel/configuracoes/ia", labelKey: "ia.title" },
  { href: "/painel/configuracoes/origens", labelKey: "crm.origins.title" },
  { href: "/painel/configuracoes/lead-score", labelKey: "crm.leadScore.configTitle" },
  { href: "/painel/configuracoes/qualidade", labelKey: "quality.configTitle" },
  { href: "/painel/configuracoes/campos-personalizados", labelKey: "crm.customFields.title" },
  { href: "/painel/configuracoes/mensagens-rapidas", labelKey: "atendimento.quickMessages.title" },
  { href: "/painel/configuracoes/notificacoes", labelKey: "notifications.whatsappSettings.title" },
  { href: "/painel/configuracoes/auditoria", labelKey: "auditLog.title" },
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-line">
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
