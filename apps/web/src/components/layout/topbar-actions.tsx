"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLogout, useMyProfile, useTenantInfo } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatGb, formatLimitGb, storageStatus, STORAGE_STATUS_CLASSES, useStorageUsage } from "@/lib/storage";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "./notification-bell";
import { MenuLayoutToggle } from "./menu-layout-toggle";

/** Bloco compacto de uso/limite de armazenamento no menu do avatar — só busca quando o menu está aberto (lazy, não pré-carrega em toda navegação). */
function AvatarMenuStorageBlock({ open }: { open: boolean }) {
  const { t, locale } = useI18n();
  const usage = useStorageUsage(open);

  if (!usage.data) return null;

  const status = storageStatus(usage.data.percentage);
  const widthPercent = usage.data.percentage == null ? 0 : Math.min(100, usage.data.percentage);

  return (
    <div className="border-b border-line px-3 py-2">
      <div className="flex items-center justify-between text-xs text-ink-dim">
        <span>{t("storage.avatarMenu.title")}</span>
        <span>
          {formatGb(usage.data.usedBytes, locale)} / {formatLimitGb(usage.data.limitMb, usage.data.unlimited, locale, t("storage.unlimited"))}
        </span>
      </div>
      {!usage.data.unlimited && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${STORAGE_STATUS_CLASSES[status]}`} style={{ width: `${widthPercent}%` }} />
        </div>
      )}
    </div>
  );
}

function initials(nome?: string): string {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

const COMPANY_NAME_MAX_CHARS = 15;

function truncateCompanyName(nome?: string): string {
  if (!nome) return " ";
  return nome.length > COMPANY_NAME_MAX_CHARS ? `${nome.slice(0, COMPANY_NAME_MAX_CHARS)}…` : nome;
}

/**
 * Grupo de ações do topo (layout do menu, tema, notificações, avatar) — o
 * idioma foi movido para dentro de Configurações.
 * — extraído do Topbar para poder ser reaproveitado dentro do HorizontalNav
 * no layout horizontal e do Sidebar no layout lateral, ficando junto do menu
 * em vez de numa barra separada.
 *
 * `showName`: no Sidebar (240px de largura) o nome ao lado do avatar não cabe
 * junto dos outros 4 ícones e vazava para fora da barra — `hidden sm:inline`
 * reage à largura da *viewport*, não à do container estreito da sidebar. No
 * HorizontalNav (barra larga) o nome continua aparecendo normalmente.
 */
export function TopbarActions({ showName = true }: { showName?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const profile = useMyProfile(true);
  const tenantInfo = useTenantInfo(true);
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  async function onLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MenuLayoutToggle />
      <ThemeToggle />
      <NotificationBell />

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-dim hover:bg-surface-alt"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {initials(profile.data?.nome)}
          </span>
          {showName && (
            <span className="hidden min-w-0 flex-col items-start sm:flex">
              <span className="truncate text-sm font-semibold leading-tight text-brand-700 dark:text-brand-300">{profile.data?.nome ?? " "}</span>
              <span className="truncate text-xs leading-tight text-ink-faint">{truncateCompanyName(tenantInfo.data?.razaoSocial)}</span>
            </span>
          )}
          {showName && (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 flex-none text-ink-faint" aria-hidden="true">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            {/* No Sidebar (showName=false) o avatar fica colado no rodapé/canto esquerdo da
                tela — abrir para baixo (top-full) deixava o menu cortado fora da viewport
                embaixo, e ancorar pela direita (right-0) cortava pela esquerda (a barra é
                estreita e fica colada na borda esquerda da tela). Ali abre para cima e para
                a direita (left-0). */}
            <div
              className={`absolute z-20 w-56 rounded-md border border-line bg-surface py-1 shadow-md ${
                showName ? "right-0 top-full mt-1" : "left-0 bottom-full mb-1"
              }`}
            >
              <div className="border-b border-line px-3 py-2">
                <p className="truncate text-sm font-medium text-ink">{profile.data?.nome}</p>
                <p className="truncate text-xs text-ink-faint">{profile.data?.email}</p>
              </div>
              <AvatarMenuStorageBlock open={menuOpen} />
              <Link
                href="/painel/meus-dados"
                onClick={() => setMenuOpen(false)}
                className="block w-full px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-alt"
              >
                {t("topbar.myData")}
              </Link>
              <Link
                href="/painel/financeiro"
                onClick={() => setMenuOpen(false)}
                className="block w-full px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-alt"
              >
                {t("nav.financeiro")}
              </Link>
              <Link
                href="/painel/seguranca"
                onClick={() => setMenuOpen(false)}
                className="block w-full px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-alt"
              >
                {t("topbar.security")}
              </Link>
              <button type="button" onClick={onLogout} className="w-full px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-alt">
                {t("topbar.signOut")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
