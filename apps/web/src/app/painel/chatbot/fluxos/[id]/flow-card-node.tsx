"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeType } from "@/lib/chatbot";
import { NODE_COLORS } from "./node-types";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";
import type { MenuNodeData } from "./node-types";

export interface FlowCardData extends Record<string, unknown> {
  flowNodeType: FlowNodeType;
  payload: Record<string, unknown>;
  selected?: boolean;
}

const TERMINAL_TYPES: FlowNodeType[] = ["end", "transfer"];
const SOURCELESS_TARGET_TYPES: FlowNodeType[] = ["start"];

function summaryFor(type: FlowNodeType, payload: Record<string, unknown>): string {
  switch (type) {
    case "message":
      return (payload.texto as string) || "—";
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

  return (
    <div
      className="min-w-[180px] max-w-[220px] rounded-lg border bg-surface shadow-sm"
      style={{ borderColor: color, borderWidth: cardData.selected ? 2 : 1 }}
    >
      {hasTarget && <Handle type="target" position={Position.Top} style={{ background: color }} />}
      <div className="rounded-t-md px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: color }}>
        {t(`chatbot.builder.nodeType.${flowNodeType}` as DictionaryKey)}
      </div>
      <div className="px-2.5 py-2 text-xs text-ink-dim break-words">{summaryFor(flowNodeType, payload) || <span className="italic text-ink-faint">{id}</span>}</div>

      {flowNodeType === "menu" && <MenuHandles color={color} opcoes={(payload as unknown as MenuNodeData).opcoes ?? []} />}
      {flowNodeType === "condition" && <ConditionHandles color={color} />}
      {!isTerminal && flowNodeType !== "menu" && flowNodeType !== "condition" && (
        <Handle type="source" position={Position.Bottom} style={{ background: color }} />
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
