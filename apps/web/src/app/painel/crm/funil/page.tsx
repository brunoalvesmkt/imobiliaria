"use client";

import { useEffect, useState } from "react";
import {
  useAddStage,
  useCloseOpportunity,
  useContacts,
  useCreateFunnel,
  useCreateOpportunity,
  useFunnels,
  useMoveOpportunityStage,
  useOpportunities,
  useReorderOpportunities,
  type Funnel,
  type Opportunity,
} from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import { useI18n } from "@/lib/i18n";

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
      <div className="flex items-center gap-3">
        <select
          value={funnel.id}
          onChange={(e) => setSelectedFunnelId(e.target.value)}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
        >
          {funnels.data.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>

      {funnel.stages.length === 0 ? <NewStageForm funnel={funnel} /> : <Board funnel={funnel} />}
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

function Board({ funnel }: { funnel: Funnel }) {
  const { t, locale } = useI18n();
  const opportunities = useOpportunities(funnel.id);
  const moveStage = useMoveOpportunityStage();
  const reorderOpportunities = useReorderOpportunities();
  const closeOpportunity = useCloseOpportunity();
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
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
      <div>
        <Button onClick={() => setShowNewOpportunity((v) => !v)}>
          {showNewOpportunity ? t("common.cancel") : t("crm.funnel.newOpportunity")}
        </Button>
      </div>

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
  const [contactId, setContactId] = useState("");
  const [valor, setValor] = useState("");
  const contacts = useContacts(search);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId) return;
    const firstStage = funnel.stages[0];
    if (!firstStage) return;
    await createOpportunity.mutateAsync({
      contactId,
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
          <input
            type="text"
            placeholder={t("crm.tasks.searchContact")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          />
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">{t("crm.tasks.selectContact")}</option>
            {contacts.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <Field label={t("crm.funnel.value")} type="number" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <div>
        <Button type="submit" loading={createOpportunity.isPending} disabled={!contactId}>
          {t("crm.funnel.createOpportunity")}
        </Button>
      </div>
    </form>
  );
}
