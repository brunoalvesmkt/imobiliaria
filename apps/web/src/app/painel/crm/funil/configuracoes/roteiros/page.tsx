"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useFunnels } from "@/lib/crm";
import {
  useCreateStageChecklistItem,
  useDeleteStageChecklistItem,
  useStageChecklistItems,
  useUpdateStageChecklistItem,
  type StageChecklistItem,
} from "@/lib/stage-checklists";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";

/** CRM > Funil > Configurações > Roteiros de Etapas — Funil → Etapa → CRUD dos itens do checklist. */
export default function StageChecklistsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const funnels = useFunnels();
  const [funnelId, setFunnelId] = useState("");
  const [stageId, setStageId] = useState("");

  const selectedFunnel = funnels.data?.find((f) => f.id === funnelId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={() => router.push("/painel/crm/funil/configuracoes")} className="mb-2 text-xs font-medium text-brand-700 hover:underline">
          {t("crm.opportunityDetail.back")}
        </button>
        <h1 className="text-lg font-semibold text-ink">{t("crm.funnelSettings.checklistsTitle")}</h1>
        <p className="mt-1 text-sm text-ink-dim">{t("crm.funnelSettings.checklistsDescription")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.checklist.selectFunnel")}</label>
          <select
            value={funnelId}
            onChange={(e) => {
              setFunnelId(e.target.value);
              setStageId("");
            }}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("crm.checklist.selectFunnel")}</option>
            {funnels.data?.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        {selectedFunnel && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">{t("crm.checklist.selectStage")}</label>
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className="rounded-md border border-line bg-surface px-3 py-2 text-sm">
              <option value="">{t("crm.checklist.selectStage")}</option>
              {selectedFunnel.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {stageId && <StageChecklistEditor stageId={stageId} />}
    </div>
  );
}

function StageChecklistEditor({ stageId }: { stageId: string }) {
  const { t } = useI18n();
  const items = useStageChecklistItems(stageId);
  const createItem = useCreateStageChecklistItem();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button variant="secondary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("crm.checklist.add")}
        </Button>
      </div>

      {showForm && (
        <ChecklistItemForm
          onCancel={() => setShowForm(false)}
          saving={createItem.isPending}
          onSubmit={async (input) => {
            await createItem.mutateAsync({ stageId, ...input });
            setShowForm(false);
          }}
        />
      )}

      <div className="flex flex-col gap-2">
        {items.data?.map((item) => (
          <ChecklistItemRow key={item.id} item={item} />
        ))}
        {items.data?.length === 0 && <p className="text-sm text-ink-faint">{t("crm.checklist.empty")}</p>}
      </div>
    </div>
  );
}

function ChecklistItemForm({
  onCancel,
  onSubmit,
  saving,
  initial,
}: {
  onCancel: () => void;
  onSubmit: (input: { titulo: string; obrigatorioMotivo?: boolean }) => void;
  saving: boolean;
  initial?: { titulo?: string; obrigatorioMotivo?: boolean };
}) {
  const { t } = useI18n();
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [obrigatorioMotivo, setObrigatorioMotivo] = useState(initial?.obrigatorioMotivo ?? false);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-alt p-4">
      <Field label={t("crm.checklist.fieldTitle")} required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={obrigatorioMotivo} onChange={(e) => setObrigatorioMotivo(e.target.checked)} />
        {t("crm.checklist.requireMotivo")}
      </label>
      <div className="flex items-center gap-2">
        <Button type="button" loading={saving} disabled={!titulo.trim()} onClick={() => onSubmit({ titulo, obrigatorioMotivo })}>
          {t("common.save")}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function ChecklistItemRow({ item }: { item: StageChecklistItem }) {
  const { t } = useI18n();
  const update = useUpdateStageChecklistItem();
  const remove = useDeleteStageChecklistItem();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <ChecklistItemForm
        initial={{ titulo: item.titulo, obrigatorioMotivo: item.obrigatorioMotivo }}
        saving={update.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          await update.mutateAsync({ id: item.id, ...input });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3 ${item.ativo ? "" : "opacity-60"}`}>
      <div>
        <p className="text-sm font-medium text-ink">{item.titulo}</p>
        {item.obrigatorioMotivo && <p className="text-xs text-ink-faint">{t("crm.checklist.requireMotivo")}</p>}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <input type="checkbox" checked={item.ativo} onChange={(e) => update.mutate({ id: item.id, ativo: e.target.checked })} />
          {t("roles.active")}
        </label>
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-ink-dim hover:underline">
          {t("common.edit")}
        </button>
        <button type="button" onClick={() => remove.mutate(item.id)} className="text-xs font-medium text-red-600 hover:underline">
          {t("common.remove")}
        </button>
      </div>
    </div>
  );
}
