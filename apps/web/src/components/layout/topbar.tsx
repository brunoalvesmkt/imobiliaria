"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLogout, useMyProfile, useTenantInfo } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationBell } from "./notification-bell";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const tenant = useTenantInfo(true);
  const profile = useMyProfile(true);
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  async function onLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={t("topbar.openMenu")}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt md:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <span className="truncate text-sm font-medium text-ink">{tenant.data?.razaoSocial ?? " "}</span>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-dim hover:bg-surface-alt"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials(profile.data?.nome)}
            </span>
            <span className="hidden sm:inline">{profile.data?.nome ?? " "}</span>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-line bg-surface py-1 shadow-md">
                <div className="border-b border-line px-3 py-2">
                  <p className="truncate text-sm font-medium text-ink">{profile.data?.nome}</p>
                  <p className="truncate text-xs text-ink-faint">{profile.data?.email}</p>
                </div>
                <Link
                  href="/painel/meus-dados"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full px-3 py-2 text-left text-sm text-ink-dim hover:bg-surface-alt"
                >
                  {t("topbar.myData")}
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
    </header>
  );
}

function initials(nome?: string): string {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
