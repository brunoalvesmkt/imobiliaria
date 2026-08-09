"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

/**
 * Hub de "Configurações do Funil" — acessado pelo menu de configurações do
 * Kanban (CRM > Funil). Reúne telas que não são específicas de um funil só
 * (Motivos, Produtos e Serviços, Roteiros de Etapas).
 */
export default function FunnelSettingsHubPage() {
  const { t } = useI18n();
  const router = useRouter();

  const links = [
    { href: "/painel/crm/funil/configuracoes/motivos", label: t("crm.funnelSettings.reasonsTitle"), description: t("crm.funnelSettings.reasonsDescription") },
    { href: "/painel/crm/funil/configuracoes/produtos", label: t("crm.products.title"), description: t("crm.products.description") },
    {
      href: "/painel/crm/funil/configuracoes/roteiros",
      label: t("crm.funnelSettings.checklistsTitle"),
      description: t("crm.funnelSettings.checklistsDescription"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={() => router.push("/painel/crm/funil")} className="mb-2 text-xs font-medium text-brand-700 hover:underline">
          {t("crm.opportunityDetail.back")}
        </button>
        <h1 className="text-lg font-semibold text-ink">{t("crm.funnelSettings.title")}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-line bg-surface p-4 hover:border-brand-400"
          >
            <p className="text-sm font-medium text-ink">{link.label}</p>
            <p className="mt-1 text-xs text-ink-dim">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
