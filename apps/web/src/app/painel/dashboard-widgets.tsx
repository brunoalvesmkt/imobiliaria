"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import { PERIOD_PRESETS, COMPARE_MODES, type PeriodFilterState, type PeriodPreset, type CompareMode, type DashboardAction } from "@/lib/dashboard";

function toDateInputValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function PeriodPresetFilter({ filter, onChange }: { filter: PeriodFilterState; onChange: (next: PeriodFilterState) => void }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange({ ...filter, preset })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter.preset === preset ? "bg-brand-500 text-white" : "bg-surface-muted text-ink-dim hover:bg-surface-alt"
            }`}
          >
            {t(`dashboard.preset.${preset}` as DictionaryKey)}
          </button>
        ))}
      </div>

      {filter.preset === "personalizado" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-dim">{t("relatorios.period.from")}</label>
            <input
              type="date"
              value={toDateInputValue(filter.from)}
              onChange={(e) => {
                const { from: _omit, ...rest } = filter;
                onChange(e.target.value ? { ...rest, from: new Date(e.target.value).toISOString() } : rest);
              }}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-dim">{t("relatorios.period.to")}</label>
            <input
              type="date"
              value={toDateInputValue(filter.to)}
              onChange={(e) => {
                const { to: _omit, ...rest } = filter;
                onChange(e.target.value ? { ...rest, to: new Date(e.target.value).toISOString() } : rest);
              }}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-ink-dim">{t("dashboard.compare.label")}</label>
        <select
          value={filter.compare}
          onChange={(e) => onChange({ ...filter, compare: e.target.value as CompareMode })}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
        >
          {COMPARE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {t(`dashboard.compare.${mode}` as DictionaryKey)}
            </option>
          ))}
        </select>

        {filter.compare === "personalizado" && (
          <>
            <input
              type="date"
              value={toDateInputValue(filter.compareFrom)}
              onChange={(e) => {
                const { compareFrom: _omit, ...rest } = filter;
                onChange(e.target.value ? { ...rest, compareFrom: new Date(e.target.value).toISOString() } : rest);
              }}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={toDateInputValue(filter.compareTo)}
              onChange={(e) => {
                const { compareTo: _omit, ...rest } = filter;
                onChange(e.target.value ? { ...rest, compareTo: new Date(e.target.value).toISOString() } : rest);
              }}
              className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"
            />
          </>
        )}
      </div>
    </div>
  );
}

export function PeriodLabel({ label }: { label: string }) {
  const { t } = useI18n();
  return (
    <p className="text-xs text-ink-faint">
      {t("dashboard.periodo.selecionado")}: <span className="font-medium text-ink-dim">{label}</span>
    </p>
  );
}

function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function KpiCard({
  label,
  value,
  delta,
  invert = false,
  comparisonLabel,
  href,
  tooltip,
}: {
  label: string;
  value: string | number;
  delta?: { valor: number; percentual: number | null } | null;
  /** Quando true, queda é positiva (ex.: tempo de espera, taxa de erro) — inverte a cor semântica. */
  invert?: boolean;
  comparisonLabel?: string | null | undefined;
  href?: string;
  tooltip?: string;
}) {
  const { t } = useI18n();

  const content = (
    <div
      title={tooltip}
      className={`flex h-full flex-col gap-1.5 rounded-lg border border-line bg-surface p-4 ${href ? "cursor-pointer transition-colors hover:border-brand-300 hover:bg-surface-alt" : ""}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {delta !== undefined && delta !== null && (
        <DeltaBadge delta={delta} invert={invert} comparisonLabel={comparisonLabel} />
      )}
      {delta === null && comparisonLabel !== undefined && <p className="text-xs text-ink-faint">{t("dashboard.compare.noBaseline")}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}

function DeltaBadge({
  delta,
  invert,
  comparisonLabel,
}: {
  delta: { valor: number; percentual: number | null };
  invert?: boolean;
  comparisonLabel?: string | null | undefined;
}) {
  const { t } = useI18n();
  if (delta.percentual === null) {
    return <p className="text-xs text-ink-faint">{t("dashboard.compare.noBaseline")}</p>;
  }

  const isUp = delta.valor > 0;
  const isFlat = delta.valor === 0;
  const isPositive = isFlat ? null : invert ? !isUp : isUp;
  const colorClass = isFlat
    ? "text-ink-faint"
    : isPositive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <p className={`flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <span aria-hidden="true">{isFlat ? "→" : isUp ? "▲" : "▼"}</span>
      {formatPercent(delta.percentual)}
      {comparisonLabel && <span className="font-normal text-ink-faint">{comparisonLabel}</span>}
    </p>
  );
}

const SEVERITY_CLASSES: Record<DashboardAction["severidade"], string> = {
  critica: "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/30",
  alta: "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/30",
  media: "border-l-4 border-l-amber-400 bg-amber-50 dark:bg-amber-950/20",
  informativa: "border-l-4 border-l-blue-400 bg-blue-50 dark:bg-blue-950/20",
};

export function ActionsBlock({ actions, dismissed, onDismiss }: { actions: DashboardAction[]; dismissed: Set<string>; onDismiss: (id: string) => void }) {
  const { t } = useI18n();
  const visible = actions.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-faint">{t("dashboard.acoes.empty")}</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {visible.map((action) => (
        <div key={action.id} className={`flex items-center justify-between gap-3 rounded-md px-4 py-3 ${SEVERITY_CLASSES[action.severidade]}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-sm font-semibold tabular-nums text-ink">
              {action.quantidade}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{action.titulo}</p>
              <p className="truncate text-xs text-ink-dim">{action.descricao}</p>
            </div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Link href={action.link} className="rounded-md bg-surface px-2.5 py-1 text-xs font-medium text-brand-700 hover:underline">
              {t("dashboard.acoes.ver")}
            </Link>
            <button
              type="button"
              onClick={() => onDismiss(action.id)}
              aria-label={t("dashboard.acoes.dispensar")}
              className="rounded-md px-1.5 py-1 text-xs text-ink-faint hover:bg-surface"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationalGrid({ operacional }: { operacional: Record<string, number | undefined> }) {
  const { t } = useI18n();
  const items: { key: string; label: DictionaryKey; tooltip: DictionaryKey; href?: string }[] = [
    { key: "atendentesOnline", label: "dashboard.operacional.atendentesOnline", tooltip: "dashboard.operacional.atendentesOnline.tooltip" },
    { key: "atendentesOffline", label: "dashboard.operacional.atendentesOffline", tooltip: "dashboard.operacional.atendentesOffline.tooltip" },
    {
      key: "conversasAguardando",
      label: "dashboard.operacional.conversasAguardando",
      tooltip: "dashboard.operacional.conversasAguardando.tooltip",
      href: "/painel/atendimento/inbox?status=open",
    },
    { key: "filasAbertas", label: "dashboard.operacional.filasAbertas", tooltip: "dashboard.operacional.filasAbertas.tooltip", href: "/painel/atendimento/equipes" },
    {
      key: "oportunidadesSemResponsavel",
      label: "dashboard.operacional.oportunidadesSemResponsavel",
      tooltip: "dashboard.operacional.oportunidadesSemResponsavel.tooltip",
      href: "/painel/crm/funil?semResponsavel=1",
    },
    { key: "tarefasVencidas", label: "dashboard.operacional.tarefasVencidas", tooltip: "dashboard.operacional.tarefasVencidas.tooltip", href: "/painel/crm/tarefas" },
    { key: "fluxosAtivos", label: "dashboard.operacional.fluxosAtivos", tooltip: "dashboard.operacional.fluxosAtivos.tooltip", href: "/painel/chatbot" },
    { key: "automacoesAtivas", label: "dashboard.operacional.automacoesAtivas", tooltip: "dashboard.operacional.automacoesAtivas.tooltip", href: "/painel/automacao" },
    { key: "automacoesComFalha", label: "dashboard.operacional.automacoesComFalha", tooltip: "dashboard.operacional.automacoesComFalha.tooltip", href: "/painel/automacao" },
    { key: "whatsappConectados", label: "dashboard.operacional.whatsappConectados", tooltip: "dashboard.operacional.whatsappConectados.tooltip", href: "/painel/whatsapp" },
    { key: "whatsappDesconectados", label: "dashboard.operacional.whatsappDesconectados", tooltip: "dashboard.operacional.whatsappDesconectados.tooltip", href: "/painel/whatsapp" },
  ];
  const visible = items.filter((i) => operacional[i.key] !== undefined);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-faint">{t("dashboard.operacional.nota")}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {visible.map((item) => {
          const card = (
            <div
              title={t(item.tooltip)}
              className={`flex h-full flex-col rounded-lg border border-line bg-surface p-3 ${item.href ? "cursor-pointer transition-colors hover:border-brand-300 hover:bg-surface-alt" : ""}`}
            >
              <p className="text-xl font-semibold tabular-nums text-ink">{operacional[item.key]}</p>
              <p className="mt-1 text-xs text-ink-faint">{t(item.label)}</p>
            </div>
          );
          return (
            <div key={item.key} className="h-full">
              {item.href ? (
                <Link href={item.href} className="block h-full">
                  {card}
                </Link>
              ) : (
                card
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UpdatedAgo({ dataUpdatedAt }: { dataUpdatedAt: number }) {
  const { t } = useI18n();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const seconds = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000));
  const text = seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}min`;

  return (
    <p className="text-xs text-ink-faint">
      {t("dashboard.updatedAgo")} {text}
    </p>
  );
}

export function defaultPeriodFilter(): PeriodFilterState {
  return { preset: "hoje" as PeriodPreset, compare: "periodoAnterior" as CompareMode };
}
