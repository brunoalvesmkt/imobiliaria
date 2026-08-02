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
      label={t("layout.menuLayout")}
      items={items}
      align="right"
      buttonClassName="flex h-8 items-center gap-1 rounded-md px-2 text-sm text-ink-dim hover:bg-surface-alt"
    />
  );
}
