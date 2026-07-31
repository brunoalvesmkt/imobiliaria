"use client";

import { useLogout } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { ImpersonationClaim } from "@/lib/auth";

export function ImpersonationBanner({ impersonation }: { impersonation: ImpersonationClaim }) {
  const { t } = useI18n();
  const logout = useLogout();

  async function onExit() {
    await logout.mutateAsync();
    window.location.href = "/master/painel/empresas";
  }

  return (
    <div className="flex flex-none items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
      <span>
        {impersonation.accessLevel === "read"
          ? t("impersonation.banner.read")
          : t("impersonation.banner.readWrite")}
      </span>
      <button type="button" onClick={onExit} className="whitespace-nowrap underline hover:no-underline">
        {t("impersonation.banner.exit")}
      </button>
    </div>
  );
}
