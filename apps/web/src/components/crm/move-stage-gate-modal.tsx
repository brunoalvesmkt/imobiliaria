"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStageChecklistItems } from "@/lib/stage-checklists";
import { OpportunityChecklistPanel } from "./opportunity-checklist-panel";
import { ModalPanel } from "@/components/ui/modal-panel";
import { Button } from "@/components/ui/button";

/**
 * Intercepta toda tentativa de mover uma oportunidade de etapa (drag ou
 * botões de seta) — se a etapa de origem não tem roteiro ativo, move
 * direto sem exibir nada; se tem, abre este modal com o mesmo painel
 * marcável da ficha da oportunidade, só libera "Confirmar mover" quando
 * todos os itens estiverem respondidos.
 */
export function MoveStageGateModal({
  opportunityId,
  originStageId,
  onConfirm,
  onClose,
  confirming,
}: {
  opportunityId: string;
  originStageId: string;
  onConfirm: () => void;
  onClose: () => void;
  confirming: boolean;
}) {
  const { t } = useI18n();
  const items = useStageChecklistItems(originStageId);
  const [allAnswered, setAllAnswered] = useState(false);
  const activeItems = (items.data ?? []).filter((i) => i.ativo);

  useEffect(() => {
    // Sem roteiro ativo na etapa de origem — move direto, sem exibir nada.
    if (items.data && activeItems.length === 0) {
      onConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.data]);

  if (items.isLoading || (items.data && activeItems.length === 0)) return null;

  return (
    <ModalPanel title={t("crm.checklist.gateTitle")} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex flex-col gap-3">
        <OpportunityChecklistPanel opportunityId={opportunityId} onAllAnsweredChange={setAllAnswered} />
        <div className="flex items-center gap-2">
          <Button type="button" disabled={!allAnswered} loading={confirming} onClick={onConfirm}>
            {t("crm.checklist.confirmMove")}
          </Button>
          <button type="button" onClick={onClose} className="text-xs font-medium text-ink-dim hover:underline">
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
