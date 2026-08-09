"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  useCreateOpportunityReason,
  useDeleteOpportunityReason,
  useOpportunityReasons,
  useUpdateOpportunityReason,
  type OpportunityReason,
} from "@/lib/opportunity-reasons";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ApiError } from "@/lib/api-client";

/**
 * CRM > Funil > Configurações > Motivos — motivos cadastráveis de
 * ganho/perda usados no fechamento de oportunidades (ver
 * CloseOpportunityModal) e nas condições de automação de
 * `opportunity.won`/`opportunity.lost`.
 */
export default function OpportunityReasonsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<"won" | "lost">("won");
  const reasons = useOpportunityReasons(tab);
  const createReason = useCreateOpportunityReason();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={() => router.push("/painel/crm/funil/configuracoes")} className="mb-2 text-xs font-medium text-brand-700 hover:underline">
          {t("crm.opportunityDetail.back")}
        </button>
        <h1 className="text-lg font-semibold text-ink">{t("crm.funnelSettings.reasonsTitle")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.funnelSettings.reasonsDescription")}</p>
      </div>

      <div className="flex items-center gap-1 border-b border-line">
        <button
          type="button"
          onClick={() => setTab("won")}
          className={`px-3 py-2 text-sm font-medium ${tab === "won" ? "border-b-2 border-brand-600 text-brand-700" : "text-ink-dim"}`}
        >
          {t("crm.funnel.win")}
        </button>
        <button
          type="button"
          onClick={() => setTab("lost")}
          className={`px-3 py-2 text-sm font-medium ${tab === "lost" ? "border-b-2 border-brand-600 text-brand-700" : "text-ink-dim"}`}
        >
          {t("crm.funnel.lose")}
        </button>
      </div>

      <div className="flex items-center justify-end">
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("crm.reasons.add")}
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {showForm && (
        <ReasonForm
          tipo={tab}
          onCancel={() => setShowForm(false)}
          onSubmit={async (input) => {
            setError(null);
            try {
              await createReason.mutateAsync({ tipo: tab, ...input });
              setShowForm(false);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : t("crm.reasons.errorGeneric"));
            }
          }}
          saving={createReason.isPending}
        />
      )}

      <div className="flex flex-col gap-2">
        {reasons.data?.map((reason) => (
          <ReasonRow key={reason.id} reason={reason} />
        ))}
        {reasons.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.reasons.empty")}</p>}
      </div>
    </div>
  );
}

function ReasonForm({
  tipo,
  onCancel,
  onSubmit,
  saving,
  initial,
}: {
  tipo: "won" | "lost";
  onCancel: () => void;
  onSubmit: (input: { nome: string; obrigatorioObservacao?: boolean }) => void;
  saving: boolean;
  initial?: { nome?: string; obrigatorioObservacao?: boolean };
}) {
  const { t } = useI18n();
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [obrigatorioObservacao, setObrigatorioObservacao] = useState(initial?.obrigatorioObservacao ?? false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-alt p-4">
      <Field label={t("crm.reasons.fieldName")} required value={nome} onChange={(e) => setNome(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={obrigatorioObservacao} onChange={(e) => setObrigatorioObservacao(e.target.checked)} />
        {t("crm.reasons.requireObservation")}
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" loading={saving} disabled={!nome.trim()} onClick={() => onSubmit({ nome, obrigatorioObservacao })}>
          {t("common.save")}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function ReasonRow({ reason }: { reason: OpportunityReason }) {
  const { t } = useI18n();
  const update = useUpdateOpportunityReason();
  const deleteReason = useDeleteOpportunityReason();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ReasonForm
        tipo={reason.tipo}
        initial={{ nome: reason.nome, obrigatorioObservacao: reason.obrigatorioObservacao }}
        saving={update.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          await update.mutateAsync({ id: reason.id, ...input });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 ${reason.ativo ? "" : "opacity-60"}`}>
      <div>
        <p className="text-sm font-medium text-ink">{reason.nome}</p>
        <label className="mt-1 flex items-center gap-1.5 text-xs text-ink-dim">
          <input
            type="checkbox"
            checked={reason.obrigatorioObservacao}
            onChange={(e) => update.mutate({ id: reason.id, obrigatorioObservacao: e.target.checked })}
          />
          {t("crm.reasons.requireObservation")}
        </label>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <input type="checkbox" checked={reason.ativo} onChange={(e) => update.mutate({ id: reason.id, ativo: e.target.checked })} />
          {t("roles.active")}
        </label>
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.edit")}
        </button>
        <button type="button" onClick={() => deleteReason.mutate(reason.id)} className="text-xs font-medium text-red-600 hover:underline">
          {t("common.remove")}
        </button>
      </div>
    </div>
  );
}
