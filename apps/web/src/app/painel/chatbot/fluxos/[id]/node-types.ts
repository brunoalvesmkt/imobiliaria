import type { FlowNodeType, ValidationType } from "@/lib/chatbot";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export type MessageMediaType = "text" | "image" | "audio" | "video" | "document" | "location";

/** Padrão do campo "Aguardar antes de enviar" para cards novos — continua editável (inclusive removível). */
export const DEFAULT_DELAY_MS = 4000;

export interface MessageNodeData {
  tipo?: MessageMediaType;
  texto: string;
  /** URL pública informada manualmente — ignorada quando `arquivoId` está presente. */
  midiaUrl?: string;
  /** Arquivo enviado por upload (ver lib/files.ts) — a referência estável é o id, nunca a URL de download (expira em minutos). */
  arquivoId?: string;
  /** Só para exibição no card/inspetor — o nome original do arquivo enviado. */
  arquivoNome?: string;
  /** Pausa (ms) simulando "digitando..." antes de enviar — ver flow-definition.types.ts no backend. */
  delayMs?: number;
}

export type TimeoutUnit = "minutes" | "hours" | "days";

/** Um passo por tentativa — `timeoutSteps[0]` é a espera antes da 1ª reativação, `[1]` antes da 2ª, etc. */
export interface TimeoutStep {
  quantidade?: number | undefined;
  unidade?: TimeoutUnit | undefined;
}

export interface QuestionNodeData {
  texto: string;
  variavel: string;
  validacao?: ValidationType;
  salvarNoCrm?: string;
  mensagemErro?: string;
  maxTentativas?: number;
  pontuacao?: number;
  timeoutEnabled?: boolean;
  timeoutMaxTentativas?: number;
  timeoutSteps?: TimeoutStep[];
  delayMs?: number;
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
  timeoutEnabled?: boolean;
  timeoutMaxTentativas?: number;
  timeoutSteps?: TimeoutStep[];
  delayMs?: number;
}

/** Saídas reservadas (`FlowEdge.sourceHandle`) da reativação por falta de resposta — ver flow-definition.types.ts no backend. */
export const TIMEOUT_HANDLE = "timeout";
export const TIMEOUT_LIMIT_HANDLE = "timeout_limit";

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

export interface CrmStageNodeData {
  funnelId: string;
  stageId: string;
}

export interface AddMenuOption {
  type: FlowNodeType;
  /** Só relevante quando `type === "message"` — pré-seleciona o tipo de mídia do card. */
  presetTipo?: MessageMediaType;
  labelKey: DictionaryKey;
  key: string;
}

export const ADD_MENU_OPTIONS: AddMenuOption[] = [
  { type: "message", key: "message:text", labelKey: "chatbot.builder.nodeType.message" },
  { type: "message", presetTipo: "image", key: "message:image", labelKey: "chatbot.builder.nodeType.message.image" },
  { type: "message", presetTipo: "audio", key: "message:audio", labelKey: "chatbot.builder.nodeType.message.audio" },
  { type: "message", presetTipo: "video", key: "message:video", labelKey: "chatbot.builder.nodeType.message.video" },
  { type: "message", presetTipo: "document", key: "message:document", labelKey: "chatbot.builder.nodeType.message.document" },
  { type: "question", key: "question", labelKey: "chatbot.builder.nodeType.question" },
  { type: "menu", key: "menu", labelKey: "chatbot.builder.nodeType.menu" },
  { type: "condition", key: "condition", labelKey: "chatbot.builder.nodeType.condition" },
  { type: "crm_stage", key: "crm_stage", labelKey: "chatbot.builder.nodeType.crm_stage" },
  { type: "subflow", key: "subflow", labelKey: "chatbot.builder.nodeType.subflow" },
  { type: "transfer", key: "transfer", labelKey: "chatbot.builder.nodeType.transfer" },
  { type: "ai", key: "ai", labelKey: "chatbot.builder.nodeType.ai" },
  { type: "knowledge_query", key: "knowledge_query", labelKey: "chatbot.builder.nodeType.knowledge_query" },
  { type: "end", key: "end", labelKey: "chatbot.builder.nodeType.end" },
];

export const MESSAGE_TYPE_LABEL_KEY: Record<MessageMediaType, DictionaryKey> = {
  text: "chatbot.builder.nodeType.message",
  image: "chatbot.builder.nodeType.message.image",
  audio: "chatbot.builder.nodeType.message.audio",
  video: "chatbot.builder.nodeType.message.video",
  document: "chatbot.builder.nodeType.message.document",
  location: "chatbot.builder.nodeType.message",
};

/** Formatos aceitos por tipo de mídia no WhatsApp — texto informativo no inspetor, não validado no backend. */
export const MESSAGE_TYPE_FORMATS: Record<MessageMediaType, string> = {
  text: "",
  image: "JPEG, PNG",
  audio: "MP3, OGG, AAC, AMR, OPUS",
  video: "MP4, 3GPP",
  document: "PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT",
  location: "",
};

/** Limites reais de tamanho de mídia do WhatsApp — validados no navegador antes do upload começar. */
export const MESSAGE_TYPE_MAX_SIZE_MB: Record<MessageMediaType, number> = {
  text: 0,
  image: 5,
  audio: 16,
  video: 16,
  document: 100,
  location: 0,
};

/** Atributo `accept` do input de arquivo — orienta o seletor do SO, a validação real é por tamanho + o backend aceita qualquer mimeType coerente com o tipo. */
export const MESSAGE_TYPE_ACCEPT: Record<MessageMediaType, string> = {
  text: "",
  image: "image/jpeg,image/png",
  audio: "audio/mpeg,audio/ogg,audio/aac,audio/amr,.mp3,.ogg,.aac,.amr,.opus",
  video: "video/mp4,video/3gpp",
  document: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt",
  location: "",
};

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
  crm_stage: "#2d8659",
  end: "#5b584f",
};

export function defaultDataFor(type: FlowNodeType, presetTipo?: MessageMediaType): Record<string, unknown> {
  switch (type) {
    case "message":
      return { tipo: presetTipo ?? "text", texto: "", delayMs: DEFAULT_DELAY_MS } satisfies MessageNodeData;
    case "question":
      return { texto: "", variavel: "", delayMs: DEFAULT_DELAY_MS } satisfies QuestionNodeData;
    case "menu":
      return { texto: "", opcoes: [{ chave: "1", texto: "" }], delayMs: DEFAULT_DELAY_MS } satisfies MenuNodeData;
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
    case "crm_stage":
      return { funnelId: "", stageId: "" } satisfies CrmStageNodeData;
    default:
      return {};
  }
}
