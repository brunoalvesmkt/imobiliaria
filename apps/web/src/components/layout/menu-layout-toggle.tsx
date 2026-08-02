"use client";

import { useMenuLayout } from "@/lib/menu-layout";
import { useI18n } from "@/lib/i18n";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function MenuLayoutToggle() {
  const { layout, setLayout } = useMenuLayout();
  const { t } = useI18n();

  const items: DropdownMenuItem[] = [
    { label: t("layout.sidebar"), onClick: () => setLayout("vertical"), disabled: layout === "vertical" },
    { label: t("layout.topbar"), onClick: () => setLayout("horizontal"), disabled: layout === "horizontal" },
  ];

  return (
    <DropdownMenu
      label={
        <svg viewBox="0 0 20 20" fill="none" className="h-4.5 w-4.5" aria-hidden="true">
          <rect x="2.5" y="3" width="15" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M7.5 3v14" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      }
      ariaLabel={t("layout.menuLayout")}
      items={items}
      align="right"
      buttonClassName="flex h-8 items-center gap-1 rounded-md px-2 text-ink-dim hover:bg-surface-alt"
    />
  );
}
