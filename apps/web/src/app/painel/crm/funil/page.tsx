"use client";

import { useEffect, useState } from "react";
import {
  useAddStage,
  useCloseOpportunity,
  useContacts,
  useCreateFunnel,
  useCreateOpportunity,
  useDeleteFunnel,
  useFunnels,
  useMoveOpportunityStage,
  useOpportunities,
  useRemoveStage,
  useReorderOpportunities,
  useTransferOpportunity,
  useUpdateFunnel,
  useUpdateStage,
  type Funnel,
  type FunnelStage,
  type Opportunity,
} from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ContactForm } from "@/components/crm/contact-form";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api-client";

export default function FunilPage() {
  const { t } = useI18n();
  const funnels = useFunnels();
  const [selectedFunnelId, setSelectedFunnelId] = useState("");

  useEffect(() => {
    const firstId = funnels.data?.[0]?.id;
    if (!selectedFunnelId && firstId) {
      setSelectedFunnelId(firstId);
    }
  }, [funnels.data, selectedFunnelId]);

  if (funnels.isLoading) return <p className="text-sm text-ink-faint">{t("common.loading")}</p>;

  if (!funnels.data || funnels.data.length === 0) {
    return <NewFunnelForm />;
  }

  const funnel = funnels.data.find((f) => f.id === selectedFunnelId) ?? funnels.data[0];
  if (!funnel) return null;

  return (
    <div className="flex flex-col gap-4">
      <FunnelToolbar
        funnels={funnels.data}
        funnel={funnel}
        onSelect={setSelectedFunnelId}
        onDeleted={() => setSelectedFunnelId("")}
      />

      {funnel.stages.length === 0 ? <NewStageForm funnel={funnel} /> : <Board funnel={funnel} otherFunnels={funnels.data.filter((f) => f.id !== funnel.id)} />}
    </div>
  );
}

function FunnelToolbar({
  funnels,
  funnel,
  onSelect,
  onDeleted,
}: {
  funnels: Funnel[];
  funnel: Funnel;
  onSelect: (id: string) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={funnel.id}
          onChange={(e) => onSelect(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
        <FunnelSettingsMenu funnel={funnel} onFunnelCreated={onSelect} onFunnelDeleted={onDeleted} onError={setError} />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

type SettingsPanelKind = "createFunnel" | "editFunnel" | "newStage" | "editStage" | "deleteStage" | "reorderStages";

function FunnelSettingsMenu({
  funnel,
  onFunnelCreated,
  onFunnelDeleted,
  onError,
}: {
  funnel: Funnel;
  onFunnelCreated: (id: string) => void;
  onFunnelDeleted: () => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<SettingsPanelKind | null>(null);
  const deleteFunnel = useDeleteFunnel();

  async function onDeleteFunnel() {
    onError(null);
    if (!window.confirm(t("crm.funnel.confirmDelete"))) return;
    try {
      await deleteFunnel.mutateAsync(funnel.id);
      onFunnelDeleted();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  const items: DropdownMenuItem[] = [
    { label: t("crm.funnel.settingsMenu.createFunnel"), onClick: () => setPanel("createFunnel") },
    { label: t("crm.funnel.settingsMenu.editFunnel"), onClick: () => setPanel("editFunnel") },
    { label: t("crm.funnel.settingsMenu.newStage"), onClick: () => setPanel("newStage") },
    { label: t("crm.funnel.settingsMenu.editStage"), onClick: () => setPanel("editStage") },
    { label: t("crm.funnel.settingsMenu.deleteStage"), onClick: () => setPanel("deleteStage") },
    { label: t("crm.funnel.settingsMenu.reorderStages"), onClick: () => setPanel("reorderStages") },
    { label: t("crm.funnel.delete"), onClick: onDeleteFunnel, disabled: deleteFunnel.isPending },
  ];

  return (
    <>
      <DropdownMenu label={t("crm.funnel.settings")} items={items} />
      {panel === "createFunnel" && (
        <SettingsPanel title={t("crm.funnel.settingsMenu.createFunnel")} onClose={() => setPanel(null)}>
          <CreateFunnelPanel
            onDone={(id) => {
              onFunnelCreated(id);
              setPanel(null);
            }}
          />
        </SettingsPanel>
      )}
      {panel === "editFunnel" && (
        <SettingsPanel title={t("crm.funnel.settingsMenu.editFunnel")} onClose={() => setPanel(null)}>
          <EditFunnelPanel funnel={funnel} onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
      {panel === "newStage" && (
        <SettingsPanel title={t("crm.funnel.settingsMenu.newStage")} onClose={() => setPanel(null)}>
          <AddStagePanel funnel={funnel} onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
      {panel === "editStage" && (
        <SettingsPanel title={t("crm.funnel.settingsMenu.editStage")} onClose={() => setPanel(null)}>
          <EditStagePanel funnel={funnel} onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
      {panel === "deleteStage" && (
        <SettingsPanel title={t("crm.funnel.settingsMenu.deleteStage")} onClose={() => setPanel(null)}>
          <DeleteStagePanel funnel={funnel} onDone={() => setPanel(null)} />
        </SettingsPanel>
      )}
      {panel === "reorderStages" && (
        <SettingsPanel title={t("crm.funnel.settingsMenu.reorderStages")} onClose={() => setPanel(null)}>
          <ReorderStagesPanel funnel={funnel} />
        </SettingsPanel>
      )}
    </>
  );
}

function SettingsPanel({
  title,
  onClose,
  children,
  maxWidth = "max-w-sm",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} rounded-lg border border-line bg-surface p-5 shadow-lg`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink" aria-label={t("common.close")}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CreateFunnelPanel({ onDone }: { onDone: (id: string) => void }) {
  const { t } = useI18n();
  const createFunnel = useCreateFunnel();
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await createFunnel.mutateAsync({ nome });
      onDone(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t("crm.funnel.funnelName")} required value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("crm.funnel.funnelNamePlaceholder")} />
      <div>
        <Button type="submit" loading={createFunnel.isPending}>
          {t("crm.funnel.createFunnel")}
        </Button>
      </div>
    </form>
  );
}

function EditFunnelPanel({ funnel, onDone }: { funnel: Funnel; onDone: () => void }) {
  const { t } = useI18n();
  const updateFunnel = useUpdateFunnel(funnel.id);
  const [nome, setNome] = useState(funnel.nome);
  const [descricao, setDescricao] = useState(funnel.descricao ?? "");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateFunnel.mutateAsync({ nome, descricao });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t("crm.funnel.funnelName")} required value={nome} onChange={(e) => setNome(e.target.value)} />
      <Field label={t("crm.funnel.funnelDescription")} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      <div>
        <Button type="submit" loading={updateFunnel.isPending}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}

function AddStagePanel({ funnel, onDone }: { funnel: Funnel; onDone: () => void }) {
  const { t } = useI18n();
  const addStage = useAddStage(funnel.id);
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addStage.mutateAsync({ nome, ordem: funnel.stages.length });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={t("crm.funnel.stageName")} required value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("crm.funnel.stageNamePlaceholder")} />
      <div>
        <Button type="submit" loading={addStage.isPending}>
          {t("crm.funnel.addStage")}
        </Button>
      </div>
    </form>
  );
}

function EditStagePanel({ funnel, onDone }: { funnel: Funnel; onDone: () => void }) {
  const { t } = useI18n();
  const [stageId, setStageId] = useState("");
  const stage = funnel.stages.find((s) => s.id === stageId);
  const updateStage = useUpdateStage(funnel.id);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("");
  const [probabilidade, setProbabilidade] = useState("");
  const [error, setError] = useState<string | null>(null);

  function selectStage(s: FunnelStage) {
    setStageId(s.id);
    setNome(s.nome);
    setCor(s.cor ?? "");
    setProbabilidade(s.probabilidade != null ? String(s.probabilidade) : "");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stageId) return;
    setError(null);
    try {
      await updateStage.mutateAsync({
        stageId,
        nome,
        ...(cor ? { cor } : {}),
        ...(probabilidade ? { probabilidade: Number(probabilidade) } : {}),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={stageId}
        onChange={(e) => {
          const s = funnel.stages.find((st) => st.id === e.target.value);
          if (s) selectStage(s);
          else setStageId("");
        }}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{t("crm.funnel.chooseStage")}</option>
        {funnel.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      {stage && (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label={t("crm.funnel.stageName")} required value={nome} onChange={(e) => setNome(e.target.value)} />
          <Field label={t("crm.funnel.stageColor")} type="color" value={cor || "#1f6f5c"} onChange={(e) => setCor(e.target.value)} />
          <Field label={t("crm.funnel.stageProbability")} type="number" min="0" max="100" value={probabilidade} onChange={(e) => setProbabilidade(e.target.value)} />
          <div>
            <Button type="submit" loading={updateStage.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function DeleteStagePanel({ funnel, onDone }: { funnel: Funnel; onDone: () => void }) {
  const { t } = useI18n();
  const removeStage = useRemoveStage(funnel.id);
  const [stageId, setStageId] = useState("");
  const [targetStageId, setTargetStageId] = useState("");
  const [needsTarget, setNeedsTarget] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!stageId) return;
    setError(null);
    try {
      await removeStage.mutateAsync({ stageId, targetStageId: targetStageId || undefined });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { opportunitiesCount?: number } | undefined;
        if (body?.opportunitiesCount) {
          setNeedsTarget(true);
          return;
        }
      }
      setError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <select
        value={stageId}
        onChange={(e) => {
          setStageId(e.target.value);
          setTargetStageId("");
          setNeedsTarget(false);
          setError(null);
        }}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{t("crm.funnel.chooseStage")}</option>
        {funnel.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      {needsTarget && (
        <select
          value={targetStageId}
          onChange={(e) => setTargetStageId(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">{t("crm.funnel.chooseTargetStage")}</option>
          {funnel.stages
            .filter((s) => s.id !== stageId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
        </select>
      )}
      {stageId && (
        <div>
          <Button
            variant="secondary"
            onClick={onDelete}
            loading={removeStage.isPending}
            disabled={needsTarget && !targetStageId}
          >
            {t("crm.funnel.removeStage")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReorderStagesPanel({ funnel }: { funnel: Funnel }) {
  const { t } = useI18n();
  const updateStage = useUpdateStage(funnel.id);
  const stages = [...funnel.stages].sort((a, b) => a.ordem - b.ordem);

  function swap(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const current = stages[index];
    const target = stages[targetIndex];
    if (!current || !target) return;
    updateStage.mutate({ stageId: current.id, ordem: target.ordem });
    updateStage.mutate({ stageId: target.id, ordem: current.ordem });
  }

  return (
    <div className="flex flex-col gap-2">
      {stages.map((s, i) => (
        <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2">
          <span className="text-sm text-ink">{s.nome}</span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => swap(i, "up")}
              className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={i === stages.length - 1}
              onClick={() => swap(i, "down")}
              className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewFunnelForm() {
  const { t } = useI18n();
  const createFunnel = useCreateFunnel();
  const [nome, setNome] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createFunnel.mutateAsync({ nome });
  }

  return (
    <div className="max-w-sm rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.funnel.newFunnelTitle")}</h2>
      <p className="mb-4 text-sm text-ink-dim">{t("crm.funnel.newFunnelSubtitle")}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label={t("crm.funnel.funnelName")} required value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("crm.funnel.funnelNamePlaceholder")} />
        <div>
          <Button type="submit" loading={createFunnel.isPending}>
            {t("crm.funnel.createFunnel")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function NewStageForm({ funnel }: { funnel: Funnel }) {
  const { t } = useI18n();
  const addStage = useAddStage(funnel.id);
  const [nome, setNome] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addStage.mutateAsync({ nome, ordem: funnel.stages.length });
    setNome("");
  }

  return (
    <div className="max-w-sm rounded-lg border border-line bg-surface p-5">
      <h2 className="mb-1 text-sm font-semibold text-ink">{t("crm.funnel.newStageTitle")}</h2>
      <p className="mb-4 text-sm text-ink-dim">{t("crm.funnel.newStageSubtitle")}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label={t("crm.funnel.stageName")} required value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t("crm.funnel.stageNamePlaceholder")} />
        <div>
          <Button type="submit" loading={addStage.isPending}>
            {t("crm.funnel.addStage")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Board({ funnel, otherFunnels }: { funnel: Funnel; otherFunnels: Funnel[] }) {
  const { t, locale } = useI18n();
  const opportunities = useOpportunities(funnel.id);
  const moveStage = useMoveOpportunityStage();
  const reorderOpportunities = useReorderOpportunities();
  const closeOpportunity = useCloseOpportunity();
  const transferOpportunity = useTransferOpportunity();
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const open = (opportunities.data ?? []).filter((o) => o.status === "open");

  function opportunitiesForStage(stageId: string): Opportunity[] {
    return open.filter((o) => o.stageId === stageId);
  }

  function moveTo(opportunity: Opportunity, direction: "prev" | "next") {
    const stages = funnel.stages;
    const currentIndex = stages.findIndex((s) => s.id === opportunity.stageId);
    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const target = stages[targetIndex];
    if (!target) return;
    moveStage.mutate({ id: opportunity.id, stageId: target.id });
  }

  function moveToStageId(opportunityId: string, stageId: string) {
    const opportunity = open.find((o) => o.id === opportunityId);
    if (!opportunity) return;
    if (opportunity.stageId !== stageId) {
      moveStage.mutate({ id: opportunityId, stageId });
    }
  }

  /** Soltar um card sobre outro card da MESMA etapa reordena; sobre etapa diferente, `moveToStageId` já cobre. */
  function reorderWithinStage(draggedOpportunityId: string, targetOpportunityId: string, stageId: string) {
    if (draggedOpportunityId === targetOpportunityId) return;
    const stageOpportunities = opportunitiesForStage(stageId);
    const currentIds = stageOpportunities.map((o) => o.id);
    const fromIndex = currentIds.indexOf(draggedOpportunityId);
    const toIndex = currentIds.indexOf(targetOpportunityId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...currentIds];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, draggedOpportunityId);
    reorderOpportunities.mutate({ stageId, orderedIds: reordered });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setShowNewContact(true)}>
          {t("crm.funnel.newContact")}
        </Button>
        <Button onClick={() => setShowNewOpportunity((v) => !v)}>
          {showNewOpportunity ? t("common.cancel") : t("crm.funnel.newOpportunity")}
        </Button>
      </div>

      {showNewContact && (
        <SettingsPanel title={t("crm.funnel.newContact")} onClose={() => setShowNewContact(false)} maxWidth="max-w-xl">
          <ContactForm onDone={() => setShowNewContact(false)} />
        </SettingsPanel>
      )}

      {showNewOpportunity && <NewOpportunityForm funnel={funnel} onDone={() => setShowNewOpportunity(false)} />}

      {funnel.stages.length > 1 && (
        <p className="px-1 text-xs text-ink-faint sm:hidden">{t("crm.funnel.swipeHint")}</p>
      )}

      <HorizontalScroller contentClassName="flex gap-4 pb-2">
        {funnel.stages.map((stage) => {
          const stageOpportunities = opportunitiesForStage(stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStageId(stage.id);
              }}
              onDragLeave={() => setDragOverStageId((current) => (current === stage.id ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStageId(null);
                const opportunityId = e.dataTransfer.getData("text/plain") || draggedId;
                if (opportunityId) moveToStageId(opportunityId, stage.id);
                setDraggedId(null);
              }}
              className={`flex w-72 flex-none snap-start flex-col gap-2 rounded-lg bg-surface-muted p-3 transition-colors ${
                dragOverStageId === stage.id ? "ring-2 ring-brand-500" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-ink">{stage.nome}</h3>
                <span className="text-xs text-ink-faint">{stageOpportunities.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {stageOpportunities.map((opportunity) => {
                  const stageIndex = funnel.stages.findIndex((s) => s.id === stage.id);
                  return (
                    <div
                      key={opportunity.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", opportunity.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedId(opportunity.id);
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDragOverStageId(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverStageId(null);
                        const sourceId = e.dataTransfer.getData("text/plain") || draggedId;
                        if (!sourceId) return;
                        const sourceOpportunity = open.find((o) => o.id === sourceId);
                        if (sourceOpportunity?.stageId === stage.id) {
                          reorderWithinStage(sourceId, opportunity.id, stage.id);
                        } else {
                          moveToStageId(sourceId, stage.id);
                        }
                        setDraggedId(null);
                      }}
                      className={`cursor-grab rounded-md border border-line bg-surface p-3 text-sm shadow-sm active:cursor-grabbing ${
                        draggedId === opportunity.id ? "opacity-40" : ""
                      }`}
                    >
                      <p className="font-medium text-ink">{opportunity.contact.nome}</p>
                      {opportunity.valor && <p className="text-ink-dim">{Number(opportunity.valor).toLocaleString(locale)}</p>}
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={stageIndex === 0}
                            onClick={() => moveTo(opportunity, "prev")}
                            className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
                          >
                            {t("crm.funnel.prevStage")}
                          </button>
                          <button
                            type="button"
                            disabled={stageIndex === funnel.stages.length - 1}
                            onClick={() => moveTo(opportunity, "next")}
                            className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
                          >
                            {t("crm.funnel.nextStage")}
                          </button>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => closeOpportunity.mutate({ id: opportunity.id, resultado: "won" })}
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                          >
                            {t("crm.funnel.win")}
                          </button>
                          <button
                            type="button"
                            onClick={() => closeOpportunity.mutate({ id: opportunity.id, resultado: "lost" })}
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            {t("crm.funnel.lose")}
                          </button>
                        </div>
                      </div>
                      {otherFunnels.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) transferOpportunity.mutate({ opportunityId: opportunity.id, targetFunnelId: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 w-full rounded border border-line bg-surface px-1.5 py-1 text-xs text-ink-dim"
                        >
                          <option value="">{t("crm.funnel.transferTo")}</option>
                          {otherFunnels.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.nome}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
                {stageOpportunities.length === 0 && <p className="px-1 text-xs text-ink-faint">{t("crm.funnel.noOpportunities")}</p>}
              </div>
            </div>
          );
        })}
      </HorizontalScroller>
    </div>
  );
}

function NewOpportunityForm({ funnel, onDone }: { funnel: Funnel; onDone: () => void }) {
  const { t } = useI18n();
  const createOpportunity = useCreateOpportunity();
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<{ id: string; nome: string } | null>(null);
  const [valor, setValor] = useState("");
  const contacts = useContacts(search);

  function selectContact(c: { id: string; nome: string }) {
    setSelectedContact(c);
  }

  function clearContact() {
    setSelectedContact(null);
    setSearch("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContact) return;
    const firstStage = funnel.stages[0];
    if (!firstStage) return;
    await createOpportunity.mutateAsync({
      contactId: selectedContact.id,
      funnelId: funnel.id,
      stageId: firstStage.id,
      ...(valor ? { valor: Number(valor) } : {}),
    });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      {createOpportunity.error && <Alert tone="error">{t("crm.funnel.errorGeneric")}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink">{t("crm.tasks.contact")}</label>
          {selectedContact ? (
            <div className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2 text-sm">
              <span className="text-ink">{selectedContact.nome}</span>
              <button type="button" onClick={clearContact} className="text-xs font-medium text-ink-faint hover:text-red-600">
                {t("common.remove")}
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder={t("crm.tasks.searchContact")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
              />
              {search.length > 0 && (contacts.data?.length ?? 0) > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-line bg-surface shadow-lg">
                  {contacts.data!.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectContact({ id: c.id, nome: c.nome })}
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-surface-alt"
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <Field label={t("crm.funnel.value")} type="number" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <div>
        <Button type="submit" loading={createOpportunity.isPending} disabled={!selectedContact}>
          {t("crm.funnel.createOpportunity")}
        </Button>
      </div>
    </form>
  );
}
