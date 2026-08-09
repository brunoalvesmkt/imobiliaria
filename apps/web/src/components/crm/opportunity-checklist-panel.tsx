"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useChecklistProgress, useUpdateChecklistProgress, type ChecklistProgressEntry } from "@/lib/stage-checklists";
import { Button } from "@/components/ui/button";

/**
 * Roteiro da etapa atual, marcável item a item — reaproveitado tanto na
 * ficha da oportunidade quanto no modal "portão" do Kanban ao tentar mover
 * de etapa, para nunca haver divergência de comportamento entre as duas
 * telas (mesmo componente, mesmos hooks). Cada resposta é salva na hora
 * (não precisa preencher tudo de uma vez); `onAllAnsweredChange` avisa o
 * pai quando todos os itens ativos já têm alguma resposta salva (usado
 * pelo Kanban para liberar o botão de confirmar mover).
 */
export function OpportunityChecklistPanel({
  opportunityId,
  onAllAnsweredChange,
}: {
  opportunityId: string;
  onAllAnsweredChange?: (allAnswered: boolean) => void;
}) {
  const { t } = useI18n();
  const progress = useChecklistProgress(opportunityId);

  useEffect(() => {
    if (!progress.data || !onAllAnsweredChange) return;
    onAllAnsweredChange(progress.data.every((entry) => entry.resultado != null));
  }, [progress.data, onAllAnsweredChange]);

  if (progress.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;
  if (!progress.data || progress.data.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {progress.data.map((entry) => (
        <ChecklistItemRow key={entry.item.id} opportunityId={opportunityId} entry={entry} />
      ))}
    </div>
  );
}

function ChecklistItemRow({ opportunityId, entry }: { opportunityId: string; entry: ChecklistProgressEntry }) {
  const { t } = useI18n();
  const update = useUpdateChecklistProgress(opportunityId);

  // Estado local, separado do já salvo — precisa existir mesmo antes de
  // qualquer valor persistido (o campo de motivo aparece assim que o
  // usuário clica "Não concluído", não só depois de salvar com sucesso).
  const [localResultado, setLocalResultado] = useState(entry.resultado);
  const [motivo, setMotivo] = useState(entry.motivo ?? "");
  const [editingMotivo, setEditingMotivo] = useState(false);

  useEffect(() => {
    setLocalResultado(entry.resultado);
    setMotivo(entry.motivo ?? "");
    setEditingMotivo(false);
  }, [entry.resultado, entry.motivo]);

  function selectConcluido() {
    setLocalResultado("concluido");
    setEditingMotivo(false);
    update.mutate({ itemId: entry.item.id, resultado: "concluido" });
  }

  function selectNaoConcluido() {
    setLocalResultado("nao_concluido");
    if (entry.item.obrigatorioMotivo) {
      setEditingMotivo(true);
    } else {
      update.mutate({ itemId: entry.item.id, resultado: "nao_concluido" });
    }
  }

  function saveMotivo() {
    update.mutate({ itemId: entry.item.id, resultado: "nao_concluido", motivo: motivo.trim() });
    setEditingMotivo(false);
  }

  function cancelMotivo() {
    setLocalResultado(entry.resultado);
    setMotivo(entry.motivo ?? "");
    setEditingMotivo(false);
  }

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <p className="text-sm font-medium text-ink">{entry.item.titulo}</p>
      <div className="mt-1.5 flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs text-ink-dim">
          <input type="radio" checked={localResultado === "concluido"} onChange={selectConcluido} />
          {t("crm.checklist.done")}
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-dim">
          <input type="radio" checked={localResultado === "nao_concluido"} onChange={selectNaoConcluido} />
          {t("crm.checklist.notDone")}
        </label>
      </div>

      {localResultado === "nao_concluido" && entry.item.obrigatorioMotivo && (
        <div className="mt-2 flex flex-col gap-1.5">
          {editingMotivo ? (
            <>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder={t("crm.checklist.motivoPlaceholder")}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
              />
              <div className="flex items-center gap-2">
                <Button type="button" disabled={!motivo.trim()} loading={update.isPending} onClick={saveMotivo}>
                  {t("common.save")}
                </Button>
                <button type="button" onClick={cancelMotivo} className="text-xs font-medium text-ink-dim hover:underline">
                  {t("common.cancel")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-ink-dim">
              <span>{motivo || t("crm.checklist.motivoMissing")}</span>
              <button type="button" onClick={() => setEditingMotivo(true)} className="font-medium text-brand-700 hover:underline">
                {t("common.edit")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
