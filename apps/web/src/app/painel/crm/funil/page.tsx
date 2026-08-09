"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { CloseOpportunityModal } from "@/components/crm/close-opportunity-modal";
import { MoveStageGateModal } from "@/components/crm/move-stage-gate-modal";
import { ModalPanel as SettingsPanel } from "@/components/ui/modal-panel";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api-client";
import { useIsAdmin } from "@/lib/auth";

export default function FunilPage() {
  const { t } = useI18n();
  const funnels = useFunnels();
  const isAdmin = useIsAdmin();
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewOpportunity, setShowNewOpportunity] = useState(false);
  const [funnelError, setFunnelError] = useState<string | null>(null);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FunnelToolbar funnels={funnels.data} funnel={funnel} onSelect={setSelectedFunnelId} />
        {funnel.stages.length > 0 && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Link
                  href="/painel/crm/funil/configuracoes"
                  className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-alt"
                >
                  {t("crm.funnel.settingsMenu.advancedSettings")}
                </Link>
                <FunnelSettingsMenu
                  funnel={funnel}
                  funnels={funnels.data}
                  onFunnelCreated={setSelectedFunnelId}
                  onFunnelDeleted={() => setSelectedFunnelId("")}
                  onError={setFunnelError}
                />
              </>
            )}
            <Button onClick={() => setShowNewOpportunity((v) => !v)}>
              {showNewOpportunity ? t("common.cancel") : t("crm.funnel.newOpportunity")}
            </Button>
          </div>
        )}
      </div>

      {funnelError && <Alert tone="error">{funnelError}</Alert>}

      {showNewContact && (
        <SettingsPanel title={t("crm.funnel.newContact")} onClose={() => setShowNewContact(false)} maxWidth="max-w-xl">
          <ContactForm onDone={() => setShowNewContact(false)} />
        </SettingsPanel>
      )}

      {funnel.stages.length === 0 ? (
        <NewStageForm funnel={funnel} />
      ) : (
        <Board
          funnel={funnel}
          showNewOpportunity={showNewOpportunity}
          onCloseNewOpportunity={() => setShowNewOpportunity(false)}
          onOpenNewContact={() => setShowNewContact(true)}
        />
      )}
    </div>
  );
}

function FunnelToolbar({
  funnels,
  funnel,
  onSelect,
}: {
  funnels: Funnel[];
  funnel: Funnel;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <select
      value={funnel.id}
      onChange={(e) => onSelect(e.target.value)}
      className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
    >
      {funnels.map((f) => (
        <option key={f.id} value={f.id}>
          {f.status === "inactive" ? `${f.nome} (${t("crm.funnel.inactiveTag")})` : f.nome}
        </option>
      ))}
    </select>
  );
}

type SettingsPanelKind =
  | "createFunnel"
  | "editFunnel"
  | "newStage"
  | "editStage"
  | "deleteStage"
  | "reorderStages"
  | "toggleActive"
  | "deleteFunnel";

function FunnelSettingsMenu({
  funnel,
  funnels,
  onFunnelCreated,
  onFunnelDeleted,
  onError,
}: {
  funnel: Funnel;
  funnels: Funnel[];
  onFunnelCreated: (id: string) => void;
  onFunnelDeleted: () => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useI18n();
  const [panel, setPanel] = useState<SettingsPanelKind | null>(null);

  const items: DropdownMenuItem[] = [
    { label: t("crm.funnel.settingsMenu.createFunnel"), onClick: () => setPanel("createFunnel") },
    { label: t("crm.funnel.settingsMenu.editFunnel"), onClick: () => setPanel("editFunnel") },
    { label: t("crm.funnel.settingsMenu.newStage"), onClick: () => setPanel("newStage") },
    { label: t("crm.funnel.settingsMenu.editStage"), onClick: () => setPanel("editStage") },
    { label: t("crm.funnel.settingsMenu.deleteStage"), onClick: () => setPanel("deleteStage") },
    { label: t("crm.funnel.settingsMenu.reorderStages"), onClick: () => setPanel("reorderStages") },
    { label: t("crm.funnel.toggleActiveMenu"), onClick: () => setPanel("toggleActive") },
    { label: t("crm.funnel.delete"), onClick: () => setPanel("deleteFunnel") },
    {
      label: t("crm.funnel.settingsMenu.advancedSettings"),
      // Navegação de página completa (não router.push) — evitou um problema
      // real observado em produção onde o clique dentro do dropdown não
      // navegava via roteamento client-side do Next.js.
      onClick: () => {
        // eslint-disable-next-line no-console
        console.log("[DEBUG] clique em Configurações do funil recebido");
        window.location.href = "/painel/crm/funil/configuracoes";
      },
    },
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
      {panel === "toggleActive" && (
        <SettingsPanel title={t("crm.funnel.toggleActiveMenu")} onClose={() => setPanel(null)}>
          <ToggleFunnelActivePanel funnels={funnels} onDone={() => setPanel(null)} onError={onError} />
        </SettingsPanel>
      )}
      {panel === "deleteFunnel" && (
        <SettingsPanel title={t("crm.funnel.delete")} onClose={() => setPanel(null)}>
          <DeleteFunnelPanel
            funnels={funnels}
            onDone={(deletedCurrent) => {
              setPanel(null);
              if (deletedCurrent) onFunnelDeleted();
            }}
            onError={onError}
          />
        </SettingsPanel>
      )}
    </>
  );
}

function ToggleFunnelActivePanel({
  funnels,
  onDone,
  onError,
}: {
  funnels: Funnel[];
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useI18n();
  const [funnelId, setFunnelId] = useState("");
  const selected = funnels.find((f) => f.id === funnelId);
  const updateFunnel = useUpdateFunnel(funnelId);
  const isActive = selected?.status !== "inactive";

  async function onToggle() {
    if (!selected) return;
    onError(null);
    try {
      await updateFunnel.mutateAsync({ status: isActive ? "inactive" : "active" });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={funnelId}
        onChange={(e) => setFunnelId(e.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{t("crm.funnel.selectFunnel")}</option>
        {funnels.map((f) => (
          <option key={f.id} value={f.id}>
            {f.status === "inactive" ? `${f.nome} (${t("crm.funnel.inactiveTag")})` : f.nome}
          </option>
        ))}
      </select>
      {selected && (
        <div>
          <Button variant="secondary" onClick={onToggle} loading={updateFunnel.isPending}>
            {isActive ? t("crm.funnel.deactivate") : t("crm.funnel.activate")}
          </Button>
        </div>
      )}
    </div>
  );
}

function DeleteFunnelPanel({
  funnels,
  onDone,
  onError,
}: {
  funnels: Funnel[];
  onDone: (deletedCurrent: boolean) => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useI18n();
  const [funnelId, setFunnelId] = useState("");
  const deleteFunnel = useDeleteFunnel();

  async function onDelete() {
    if (!funnelId) return;
    onError(null);
    try {
      await deleteFunnel.mutateAsync(funnelId);
      onDone(true);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : t("crm.funnel.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={funnelId}
        onChange={(e) => setFunnelId(e.target.value)}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">{t("crm.funnel.selectFunnel")}</option>
        {funnels.map((f) => (
          <option key={f.id} value={f.id}>
            {f.status === "inactive" ? `${f.nome} (${t("crm.funnel.inactiveTag")})` : f.nome}
          </option>
        ))}
      </select>
      {funnelId && (
        <div>
          <Button variant="secondary" onClick={onDelete} loading={deleteFunnel.isPending}>
            {t("crm.funnel.delete")}
          </Button>
        </div>
      )}
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

/** Ganhar/Perder no card do Kanban — mesmo ícone de joinha, "Perder" só gira 180° (fica de ponta-cabeça) e muda de cor. */
function ThumbIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-4 w-4 ${direction === "down" ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M2 21h2a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H2v11ZM22 11.5a2 2 0 0 0-2-2h-5.42l.72-3.6a2 2 0 0 0-.49-1.74A2 2 0 0 0 13.28 3.4h-.09a1 1 0 0 0-.9.56L8.5 10H7v11h11.06a2 2 0 0 0 1.92-1.42l1.83-6.15a2 2 0 0 0 .19-.84v-1.09Z" />
    </svg>
  );
}

/** "3d 4h" / "45min" a partir de um timestamp ISO até agora — usado nos cards do Kanban. */
function formatElapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) return `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;
  return remainingHours === 0 ? `${days}d` : `${days}d ${remainingHours}h`;
}

function Board({
  funnel,
  showNewOpportunity,
  onCloseNewOpportunity,
  onOpenNewContact,
}: {
  funnel: Funnel;
  showNewOpportunity: boolean;
  onCloseNewOpportunity: () => void;
  onOpenNewContact: () => void;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const onlySemResponsavel = searchParams.get("semResponsavel") === "1";
  const opportunities = useOpportunities(funnel.id);
  const moveStage = useMoveOpportunityStage();
  const reorderOpportunities = useReorderOpportunities();
  const closeOpportunity = useCloseOpportunity();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [closingOpportunity, setClosingOpportunity] = useState<{ id: string; resultado: "won" | "lost" } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ opportunityId: string; originStageId: string; targetStageId: string } | null>(null);

  const open = (opportunities.data ?? []).filter(
    (o) => o.status === "open" && (!onlySemResponsavel || !o.responsavelId),
  );

  function opportunitiesForStage(stageId: string): Opportunity[] {
    return open.filter((o) => o.stageId === stageId);
  }

  // Todo card na mesma posição (1º, 2º, ...) em qualquer etapa fica com a altura do maior deles
  // nessa posição, independente da quantidade de informação em cada um — via CSS Grid: as colunas
  // do funil formam uma única grade (não pilhas independentes), e cada linha da grade naturalmente
  // assume a altura do maior item colocado nela. `maxCards` define quantas linhas a grade precisa.
  const maxCards = Math.max(1, ...funnel.stages.map((s) => opportunitiesForStage(s.id).length));

  function moveTo(opportunity: Opportunity, direction: "prev" | "next") {
    const stages = funnel.stages;
    const currentIndex = stages.findIndex((s) => s.id === opportunity.stageId);
    const targetIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const target = stages[targetIndex];
    if (!target) return;
    setPendingMove({ opportunityId: opportunity.id, originStageId: opportunity.stageId, targetStageId: target.id });
  }

  function moveToStageId(opportunityId: string, stageId: string) {
    const opportunity = open.find((o) => o.id === opportunityId);
    if (!opportunity) return;
    if (opportunity.stageId !== stageId) {
      setPendingMove({ opportunityId, originStageId: opportunity.stageId, targetStageId: stageId });
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
      {onlySemResponsavel && (
        <div className="flex items-center gap-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm text-ink-dim">
          {t("crm.funnel.semResponsavelFilterActive")}
          <Link href="/painel/crm/funil" className="font-medium text-brand-700 underline">
            {t("crm.funnel.semResponsavelFilterClear")}
          </Link>
        </div>
      )}

      {showNewOpportunity && (
        <NewOpportunityForm funnel={funnel} onDone={onCloseNewOpportunity} onOpenNewContact={onOpenNewContact} />
      )}

      {funnel.stages.length > 1 && (
        <p className="px-1 text-xs text-ink-faint sm:hidden">{t("crm.funnel.swipeHint")}</p>
      )}

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(50, z - 10))}
          disabled={zoom <= 50}
          aria-label={t("crm.funnel.zoomOut")}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-dim hover:bg-surface-alt disabled:opacity-40"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => setZoom(100)}
          className="w-12 rounded-md px-1 text-center text-xs text-ink-faint hover:text-ink"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(150, z + 10))}
          disabled={zoom >= 150}
          aria-label={t("crm.funnel.zoomIn")}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-dim hover:bg-surface-alt disabled:opacity-40"
        >
          +
        </button>
      </div>

      <HorizontalScroller
        contentClassName="grid pb-2"
        contentStyle={{
          gridTemplateColumns: `repeat(${funnel.stages.length}, 18rem)`,
          gridTemplateRows: `auto repeat(${maxCards}, auto)`,
          columnGap: "1rem",
          rowGap: "0.5rem",
          zoom: zoom / 100,
        }}
      >
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
              style={{ gridTemplateRows: "subgrid", gridRow: `span ${maxCards + 1}`, rowGap: "0.5rem" }}
              className={`grid w-72 flex-none snap-start rounded-lg bg-surface-muted p-3 transition-colors ${
                dragOverStageId === stage.id ? "ring-2 ring-brand-500" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1" style={{ gridRow: 1 }}>
                <h3 className="text-sm font-semibold text-ink">{stage.nome}</h3>
                <span className="text-xs text-ink-faint">{stageOpportunities.length}</span>
              </div>
              {stageOpportunities.map((opportunity, cardIndex) => {
                  const stageIndex = funnel.stages.findIndex((s) => s.id === stage.id);
                  return (
                    <div
                      key={opportunity.id}
                      style={{ gridRow: cardIndex + 2 }}
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
                      onClick={() => router.push(`/painel/crm/oportunidades/${opportunity.id}`)}
                      className={`flex cursor-pointer flex-col rounded-md border border-line bg-surface p-3 text-sm shadow-sm hover:border-brand-400 active:cursor-grabbing ${
                        draggedId === opportunity.id ? "opacity-40" : ""
                      }`}
                    >
                      <p className="font-medium text-ink">{opportunity.contact.nome}</p>
                      {opportunity.valor && <p className="text-ink-dim">R$ {Number(opportunity.valor).toLocaleString(locale)}</p>}
                      <p className="mt-1 text-xs text-ink-faint">
                        {t("crm.funnel.createdAgo")} {formatElapsed(opportunity.createdAt)}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {t("crm.funnel.inStageAgo")} {formatElapsed(opportunity.stageEnteredAt)}
                      </p>
                      {/* mt-auto empurra as setas/joinhas para a base do card — junto com a altura igual por linha (subgrid), isso alinha essa linha de ações na mesma posição vertical em todos os cards da linha. */}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={stageIndex === 0}
                            title={t("crm.funnel.prevStageTitle")}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTo(opportunity, "prev");
                            }}
                            className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
                          >
                            {t("crm.funnel.prevStage")}
                          </button>
                          <button
                            type="button"
                            disabled={stageIndex === funnel.stages.length - 1}
                            title={t("crm.funnel.nextStageTitle")}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveTo(opportunity, "next");
                            }}
                            className="rounded border border-line px-1.5 py-0.5 text-xs text-ink-dim hover:bg-surface-alt disabled:opacity-30"
                          >
                            {t("crm.funnel.nextStage")}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title={t("crm.funnel.win")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosingOpportunity({ id: opportunity.id, resultado: "won" });
                            }}
                            className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          >
                            <ThumbIcon direction="up" />
                          </button>
                          <button
                            type="button"
                            title={t("crm.funnel.lose")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setClosingOpportunity({ id: opportunity.id, resultado: "lost" });
                            }}
                            className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <ThumbIcon direction="down" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
              })}
              {stageOpportunities.length === 0 && (
                <p className="px-1 text-xs text-ink-faint" style={{ gridRow: 2 }}>
                  {t("crm.funnel.noOpportunities")}
                </p>
              )}
            </div>
          );
        })}
      </HorizontalScroller>

      {closingOpportunity && (
        <CloseOpportunityModal
          resultado={closingOpportunity.resultado}
          saving={closeOpportunity.isPending}
          onClose={() => setClosingOpportunity(null)}
          onConfirm={(input) => {
            closeOpportunity.mutate(
              { id: closingOpportunity.id, resultado: closingOpportunity.resultado, ...input },
              { onSuccess: () => setClosingOpportunity(null) },
            );
          }}
        />
      )}

      {pendingMove && (
        <MoveStageGateModal
          opportunityId={pendingMove.opportunityId}
          originStageId={pendingMove.originStageId}
          confirming={moveStage.isPending}
          onClose={() => setPendingMove(null)}
          onConfirm={() => {
            moveStage.mutate(
              { id: pendingMove.opportunityId, stageId: pendingMove.targetStageId },
              { onSuccess: () => setPendingMove(null) },
            );
          }}
        />
      )}
    </div>
  );
}

function NewOpportunityForm({
  funnel,
  onDone,
  onOpenNewContact,
}: {
  funnel: Funnel;
  onDone: () => void;
  onOpenNewContact: () => void;
}) {
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
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onOpenNewContact}>
          {t("crm.funnel.newContact")}
        </Button>
        <Button type="submit" loading={createOpportunity.isPending} disabled={!selectedContact}>
          {t("crm.funnel.createOpportunity")}
        </Button>
      </div>
    </form>
  );
}
