"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useOpportunityReasons } from "@/lib/opportunity-reasons";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const OUTRO_VALUE = "__outro__";

/**
 * Modal de fechamento de oportunidade (ganhar/perder) — motivo cadastrado
 * (`OpportunityReason`) ou "Outro" com texto livre, mais observação opcional
 * (obrigatória quando o motivo escolhido exige, ver `obrigatorioObservacao`).
 * Reaproveitado no Kanban e na ficha da oportunidade para nunca haver
 * divergência de comportamento entre as duas telas.
 */
export function CloseOpportunityModal({
  resultado,
  onConfirm,
  onClose,
  saving,
}: {
  resultado: "won" | "lost";
  onConfirm: (input: { motivo: string | undefined; observacao: string | undefined }) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const { t } = useI18n();
  const reasons = useOpportunityReasons(resultado);
  const [selected, setSelected] = useState<string>("");
  const [outroTexto, setOutroTexto] = useState("");
  const [observacao, setObservacao] = useState("");

  const selectedReason = reasons.data?.find((r) => r.id === selected);
  const isOutro = selected === OUTRO_VALUE;
  const motivo = isOutro ? outroTexto.trim() : selectedReason?.nome;
  const observacaoRequired = !!selectedReason?.obrigatorioObservacao;
  const canConfirm = (!isOutro || outroTexto.trim().length > 0) && (!observacaoRequired || observacao.trim().length > 0);

  return (
    <ModalPanel
      title={resultado === "won" ? t("crm.closeModal.titleWon") : t("crm.closeModal.titleLost")}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.closeModal.reasonLabel")}</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("crm.closeModal.reasonNone")}</option>
            {reasons.data?.filter((r) => r.ativo).map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
            <option value={OUTRO_VALUE}>{t("crm.closeModal.reasonOther")}</option>
          </select>
        </div>

        {isOutro && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">{t("crm.closeModal.otherLabel")}</label>
            <input
              value={outroTexto}
              onChange={(e) => setOutroTexto(e.target.value)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">
            {t("crm.closeModal.observationLabel")}
            {observacaoRequired && <span className="text-red-600"> *</span>}
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
          {observacaoRequired && !observacao.trim() && (
            <Alert tone="info">{t("crm.closeModal.observationRequiredHint")}</Alert>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" loading={saving} disabled={!canConfirm} onClick={() => onConfirm({ motivo, observacao: observacao.trim() || undefined })}>
            {t("common.confirm")}
          </Button>
          <button type="button" onClick={onClose} className="text-xs font-medium text-ink-dim hover:underline">
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
