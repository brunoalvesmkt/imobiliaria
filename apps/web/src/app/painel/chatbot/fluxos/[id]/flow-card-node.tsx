"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeType } from "@/lib/chatbot";
import {
  ADD_MENU_OPTIONS,
  MESSAGE_TYPE_LABEL_KEY,
  NODE_COLORS,
  TIMEOUT_HANDLE,
  TIMEOUT_LIMIT_HANDLE,
  type MessageMediaType,
  type MessageNodeData,
  type TimeoutStep,
} from "./node-types";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import type { MenuNodeData, QuestionNodeData } from "./node-types";

export interface FlowCardData extends Record<string, unknown> {
  flowNodeType: FlowNodeType;
  payload: Record<string, unknown>;
  selected?: boolean;
  readOnly?: boolean;
  onDeleteNode?: (id: string) => void;
  onAddConnectedNode?: (id: string, type: FlowNodeType, presetTipo?: MessageMediaType) => void;
}

const TERMINAL_TYPES: FlowNodeType[] = ["end", "transfer"];
const SOURCELESS_TARGET_TYPES: FlowNodeType[] = ["start"];

function headerLabelKey(type: FlowNodeType, payload: Record<string, unknown>): DictionaryKey {
  if (type === "message") {
    const tipo = ((payload as unknown as MessageNodeData).tipo ?? "text") as MessageMediaType;
    return MESSAGE_TYPE_LABEL_KEY[tipo] ?? "chatbot.builder.nodeType.message";
  }
  return `chatbot.builder.nodeType.${type}` as DictionaryKey;
}

function summaryFor(type: FlowNodeType, payload: Record<string, unknown>): string {
  switch (type) {
    case "message":
      return (payload.texto as string) || (payload.midiaUrl as string) || "—";
    case "question":
      return (payload.texto as string) || "—";
    case "menu":
      return (payload.texto as string) || "—";
    case "condition":
      return payload.campo ? `${payload.campo} ${payload.operador} ${payload.valor ?? ""}`.trim() : "—";
    case "subflow":
      return (payload.subflowId as string) ? "" : "—";
    case "transfer":
      return "";
    case "ai":
      return (payload.prompt as string) || "—";
    case "knowledge_query":
      return (payload.tipo as string) || "—";
    case "crm_stage":
      return "";
    default:
      return "";
  }
}

export function FlowCardNode({ data, id }: NodeProps) {
  const { t } = useI18n();
  const cardData = data as FlowCardData;
  const { flowNodeType, payload } = cardData;
  const color = NODE_COLORS[flowNodeType];
  const isTerminal = TERMINAL_TYPES.includes(flowNodeType);
  const hasTarget = !SOURCELESS_TARGET_TYPES.includes(flowNodeType);
  // O card "Início" é o ponto de entrada obrigatório do fluxo — não pode ser removido individualmente.
  const isDeletable = !SOURCELESS_TARGET_TYPES.includes(flowNodeType) && !cardData.readOnly;
  const timeoutEnabled =
    (flowNodeType === "question" || flowNodeType === "menu") &&
    Boolean((payload as unknown as QuestionNodeData | MenuNodeData).timeoutEnabled);
  // Só cards com uma única saída simples (handle inferior) ganham o atalho "+" —
  // "menu"/"condition" têm múltiplas saídas nomeadas (e "question"/"menu" com reativação ativada
  // ganham as saídas extras "Não respondeu"/"Limite atingido") e exigem escolher o ramo manualmente.
  const canAddConnected =
    !isTerminal && flowNodeType !== "menu" && flowNodeType !== "condition" && !timeoutEnabled && !cardData.readOnly;

  return (
    <div
      className="relative min-w-[180px] max-w-[220px] rounded-lg border bg-surface shadow-sm"
      style={{ borderColor: color, borderWidth: cardData.selected ? 2 : 1 }}
    >
      {isDeletable && (
        <button
          type="button"
          title={t("chatbot.builder.deleteNode")}
          onClick={(e) => {
            e.stopPropagation();
            cardData.onDeleteNode?.(id);
          }}
          className="absolute -right-2 -top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
        >
          <span className="relative block h-2.5 w-2.5">
            <span className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-white" />
            <span className="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-white" />
          </span>
        </button>
      )}
      {hasTarget && <Handle type="target" position={Position.Top} style={{ background: color }} />}
      <div className="rounded-t-md px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: color }}>
        {t(headerLabelKey(flowNodeType, payload))}
      </div>
      <div className="px-2.5 py-2 text-xs text-ink-dim break-words">{summaryFor(flowNodeType, payload) || <span className="italic text-ink-faint">{id}</span>}</div>

      {flowNodeType === "menu" && <MenuHandles color={color} opcoes={(payload as unknown as MenuNodeData).opcoes ?? []} />}
      {flowNodeType === "condition" && <ConditionHandles color={color} />}
      {!isTerminal && flowNodeType !== "menu" && flowNodeType !== "condition" && (
        <Handle type="source" position={Position.Bottom} style={{ background: color }} />
      )}
      {timeoutEnabled && (
        <TimeoutHandles
          color={color}
          steps={(payload as unknown as QuestionNodeData | MenuNodeData).timeoutSteps}
          maxTentativas={(payload as unknown as QuestionNodeData | MenuNodeData).timeoutMaxTentativas}
        />
      )}

      {canAddConnected && (
        <AddConnectedButton onAdd={(type, presetTipo) => cardData.onAddConnectedNode?.(id, type, presetTipo)} />
      )}
    </div>
  );
}

function AddConnectedButton({ onAdd }: { onAdd: (type: FlowNodeType, presetTipo?: MessageMediaType) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      // Fase de captura: o canvas do React Flow intercepta/pára a propagação de mousedown na
      // fase de bolha para lidar com pan/drag, o que impedia este listener de disparar ao clicar
      // nele — mas a fase de captura também ignora e.stopPropagation() de dentro do menu (React
      // synthetic events só afetam a bolha), então checamos manualmente se o clique foi dentro
      // do botão ou do menu (portalizado em document.body) antes de fechar.
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick, true);
    return () => document.removeEventListener("mousedown", onDocClick, true);
  }, [open]);

  function toggleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="absolute -bottom-2 -right-2 z-10">
      <button
        ref={buttonRef}
        type="button"
        title={t("chatbot.builder.addNode")}
        onClick={toggleOpen}
        className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white shadow hover:bg-brand-700"
      >
        <span className="relative block h-2.5 w-2.5">
          <span className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 rounded-full bg-white" />
          <span className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 rounded-full bg-white" />
        </span>
      </button>
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[9999] w-52 rounded-md border border-line bg-surface py-1 shadow-lg"
          >
            {ADD_MENU_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onAdd(opt.type, opt.presetTipo);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-alt"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: NODE_COLORS[opt.type] }} />
                {t(opt.labelKey)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function MenuHandles({ color, opcoes }: { color: string; opcoes: MenuNodeData["opcoes"] }) {
  if (opcoes.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-line px-2.5 py-1.5">
      {opcoes.map((opt) => (
        <div key={opt.chave} className="relative flex items-center justify-between text-[11px] text-ink-faint">
          <span>{opt.chave}</span>
          <Handle
            type="source"
            position={Position.Right}
            id={opt.chave}
            style={{ background: color, position: "relative", right: -8, top: 0, transform: "none" }}
          />
        </div>
      ))}
    </div>
  );
}

/** Saídas visuais da reativação por falta de resposta — mesmo padrão de MenuHandles, conexão real no canvas (nunca um seletor). */
function TimeoutHandles({
  color,
  steps,
  maxTentativas,
}: {
  color: string;
  steps?: TimeoutStep[] | undefined;
  maxTentativas?: number | undefined;
}) {
  const { t } = useI18n();
  const summary = (steps ?? [])
    .filter((s) => Boolean(s?.quantidade))
    .map((s) => `${s.quantidade}${t(`chatbot.builder.field.timeoutUnit.${s.unidade ?? "minutes"}` as DictionaryKey).charAt(0).toLowerCase()}`)
    .join(", ");
  return (
    <div className="flex flex-col gap-1 border-t border-dashed px-2.5 py-1.5" style={{ borderColor: color }}>
      {Boolean(summary) && (
        <p className="text-[10px] text-ink-faint">
          ⏱ {summary} · {t("chatbot.builder.field.timeoutMaxTentativas")}: {maxTentativas ?? 1}
        </p>
      )}
      <div className="relative flex items-center justify-between text-[11px] text-ink-faint">
        <span>{t("chatbot.builder.field.timeoutNoResponse")}</span>
        <Handle
          type="source"
          position={Position.Right}
          id={TIMEOUT_HANDLE}
          style={{ background: color, position: "relative", right: -8, top: 0, transform: "none" }}
        />
      </div>
      <div className="relative flex items-center justify-between text-[11px] text-ink-faint">
        <span>{t("chatbot.builder.field.timeoutLimitReached")}</span>
        <Handle
          type="source"
          position={Position.Right}
          id={TIMEOUT_LIMIT_HANDLE}
          style={{ background: color, position: "relative", right: -8, top: 0, transform: "none" }}
        />
      </div>
    </div>
  );
}

function ConditionHandles({ color }: { color: string }) {
  return (
    <div className="flex justify-between border-t border-line px-2.5 py-1.5 text-[11px] text-ink-faint">
      <div className="relative flex items-center gap-1">
        <span>true</span>
        <Handle type="source" position={Position.Bottom} id="true" style={{ background: color, position: "relative", transform: "none" }} />
      </div>
      <div className="relative flex items-center gap-1">
        <span>false</span>
        <Handle type="source" position={Position.Bottom} id="false" style={{ background: color, position: "relative", transform: "none" }} />
      </div>
    </div>
  );
}
