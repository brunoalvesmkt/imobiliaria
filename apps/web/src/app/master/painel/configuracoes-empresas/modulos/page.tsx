"use client";

import { useI18n } from "@/lib/i18n";
import { useMasterSettings, useUpdateMasterSettings } from "@/lib/master-settings";
import { Alert } from "@/components/ui/alert";
import { REORDERABLE_NAV_ITEMS } from "@/components/layout/nav-items";
import { Section } from "../_shared";

export default function MasterSettingsModulosPage() {
  const { t } = useI18n();
  const settings = useMasterSettings();
  const update = useUpdateMasterSettings();

  if (settings.isLoading) return <p className="text-sm text-ink-dim">{t("common.loading")}</p>;
  if (!settings.data) return null;

  const savedOrder = settings.data.moduleOrder;
  const keys = REORDERABLE_NAV_ITEMS.map((item) => item.key);
  const orderedKeys = savedOrder && savedOrder.length > 0 ? [...savedOrder, ...keys.filter((k) => !savedOrder.includes(k))] : keys;
  const items = orderedKeys
    .map((key) => REORDERABLE_NAV_ITEMS.find((item) => item.key === key))
    .filter((item): item is (typeof REORDERABLE_NAV_ITEMS)[number] => !!item);

  function swap(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedKeys.length) return;
    const next = [...orderedKeys];
    const tmp = next[index]!;
    next[index] = next[targetIndex]!;
    next[targetIndex] = tmp;
    update.mutate({ moduleOrder: next });
  }

  return (
    <div className="flex flex-col gap-6">
      {update.isError && <Alert tone="error">{t("master.settings.errorGeneric")}</Alert>}

      <Section title={t("master.settings.modules.title")}>
        <p className="text-xs text-ink-faint">{t("master.settings.modules.subtitle")}</p>
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={item.key} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
              <span className="text-sm text-ink">{t(item.labelKey)}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={i === 0 || update.isPending}
                  onClick={() => swap(i, "up")}
                  className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === items.length - 1 || update.isPending}
                  onClick={() => swap(i, "down")}
                  className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
