import type { FlowNodeType, ValidationType } from "@/lib/chatbot";

export interface MessageNodeData {
  tipo?: "text" | "image" | "audio" | "video" | "document" | "location";
  texto: string;
  midiaUrl?: string;
}

export interface QuestionNodeData {
  texto: string;
  variavel: string;
  validacao?: ValidationType;
  salvarNoCrm?: string;
  mensagemErro?: string;
  maxTentativas?: number;
  pontuacao?: number;
}

export interface MenuOption {
  chave: string;
  texto: string;
  pontuacao?: number;
}

export interface MenuNodeData {
  texto: string;
  opcoes: MenuOption[];
  variavel?: string;
  mensagemErro?: string;
  maxTentativas?: number;
}

export type ConditionOperator = "equals" | "contains" | "exists" | "not_exists";

export interface ConditionNodeData {
  campo: string;
  operador: ConditionOperator;
  valor?: string;
}

export interface SubflowNodeData {
  subflowId: string;
}

export interface TransferNodeData {
  queueId?: string;
  tenantUserId?: string;
}

export type AiProviderName = "anthropic" | "openai" | "google";

export interface AiNodeData {
  provider: AiProviderName;
  prompt: string;
  variavel?: string;
}

export interface KnowledgeQueryNodeData {
  provider: AiProviderName;
  tipo?: string;
  variavel?: string;
}

export const ADDABLE_TYPES: FlowNodeType[] = ["message", "question", "menu", "condition", "subflow", "transfer", "ai", "knowledge_query", "end"];

export const NODE_COLORS: Record<FlowNodeType, string> = {
  start: "#1f6f5c",
  message: "#3b7fd4",
  question: "#8a5bd6",
  menu: "#c07a2d",
  condition: "#b5651d",
  subflow: "#4a6fa1",
  transfer: "#b23a3a",
  ai: "#7c3aed",
  knowledge_query: "#0f9d8f",
  end: "#5b584f",
};

export function defaultDataFor(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case "message":
      return { tipo: "text", texto: "" } satisfies MessageNodeData;
    case "question":
      return { texto: "", variavel: "" } satisfies QuestionNodeData;
    case "menu":
      return { texto: "", opcoes: [{ chave: "1", texto: "" }] } satisfies MenuNodeData;
    case "condition":
      return { campo: "", operador: "equals" } satisfies ConditionNodeData;
    case "subflow":
      return { subflowId: "" } satisfies SubflowNodeData;
    case "transfer":
      return {} satisfies TransferNodeData;
    case "ai":
      return { provider: "anthropic", prompt: "" } satisfies AiNodeData;
    case "knowledge_query":
      return { provider: "anthropic" } satisfies KnowledgeQueryNodeData;
    default:
      return {};
  }
}
