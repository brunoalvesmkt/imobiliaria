"use client";

import { useI18n } from "@/lib/i18n";

/**
 * No layout vertical, só existe para abrir o menu lateral no mobile (o
 * bloco de ações — layout do menu, idioma, tema, notificações, avatar —
 * mora dentro do Sidebar/HorizontalNav agora, não mais numa barra de topo
 * separada). Por isso o próprio layout.tsx só renderiza isto em `md:hidden`.
 */
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { t } = useI18n();

  return (
    <header className="flex h-14 flex-none items-center border-b border-line bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label={t("topbar.openMenu")}
        className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}
