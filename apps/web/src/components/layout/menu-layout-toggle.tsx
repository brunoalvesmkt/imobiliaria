"use client";

import { useMenuLayout } from "@/lib/menu-layout";
import { useI18n } from "@/lib/i18n";

export function MenuLayoutToggle() {
  const { layout, setLayout } = useMenuLayout();
  const { t } = useI18n();

  function toggle() {
    setLayout(layout === "vertical" ? "horizontal" : "vertical");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={t("layout.menuLayout")}
      aria-label={t("layout.menuLayout")}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <rect x="2.5" y="3" width="15" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7.5 3v14" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}
