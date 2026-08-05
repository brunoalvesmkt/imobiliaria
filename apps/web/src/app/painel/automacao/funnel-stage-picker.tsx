"use client";

import { useState } from "react";
import { useFunnels } from "@/lib/crm";
import { useI18n } from "@/lib/i18n";

/** Seletor de Funil + Etapa (por nome) — usado em qualquer lugar da Automação que precise de um `stageId` (ação "Mover etapa da oportunidade", condições sobre `stageId`/`stageIdAnterior`), evitando digitar o ID de cor. */
export function FunnelStagePicker({ value, onChange }: { value: string; onChange: (stageId: string) => void }) {
  const { t } = useI18n();
  const funnels = useFunnels();
  const currentFunnel = (funnels.data ?? []).find((f) => f.stages.some((s) => s.id === value));
  const [funnelId, setFunnelId] = useState(currentFunnel?.id ?? "");
  const selectedFunnel = (funnels.data ?? []).find((f) => f.id === (funnelId || currentFunnel?.id));

  return (
    <div className="flex flex-1 items-center gap-1">
      <select
        value={funnelId || currentFunnel?.id || ""}
        onChange={(e) => {
          setFunnelId(e.target.value);
          onChange("");
        }}
        title={t("automation.actions.field.funnel")}
        className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
      >
        <option value="" />
        {funnels.data?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!selectedFunnel}
        title={t("automation.actions.field.stage")}
        className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
      >
        <option value="" />
        {selectedFunnel?.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
