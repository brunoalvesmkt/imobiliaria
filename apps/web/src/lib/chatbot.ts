import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "./api-client";

export type FlowStatus = "draft" | "published" | "paused" | "archived";

export interface ChatbotFlow {
  id: string;
  nome: string;
  descricao: string | null;
  status: FlowStatus;
  versaoAtual: number;
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FlowNodeType =
  | "start"
  | "message"
  | "question"
  | "menu"
  | "condition"
  | "subflow"
  | "transfer"
  | "ai"
  | "knowledge_query"
  | "crm_stage"
  | "end";
export type ValidationType = "texto" | "numero" | "email" | "cpf" | "cnpj" | "telefone" | "data";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface ChatbotFlowVersion {
  id: string;
  chatbotFlowId: string;
  versao: number;
  definicao: FlowDefinition;
  publicadaEm: string | null;
  createdAt: string;
}

export interface FlowValidationError {
  message: string;
  nodeId?: string;
}

export type KnowledgeItemType =
  | "empresa"
  | "produto"
  | "servico"
  | "preco"
  | "politica"
  | "horario"
  | "entrega"
  | "garantia"
  | "pagamento"
  | "faq"
  | "documento"
  | "texto";

export interface KnowledgeBaseItem {
  id: string;
  tipo: KnowledgeItemType;
  titulo: string;
  conteudo: string;
  arquivoId: string | null;
  campanha: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  variacoes: string[];
  palavraChave: string | null;
  prioridade: number;
}

export function useFlows() {
  return useQuery({ queryKey: ["chatbot", "flows"], queryFn: () => apiGet<ChatbotFlow[]>("/chatbot/flows") });
}

export function useFlow(id: string) {
  return useQuery({
    queryKey: ["chatbot", "flows", id],
    queryFn: () => apiGet<ChatbotFlow>(`/chatbot/flows/${id}`),
    enabled: !!id,
  });
}

export function useFlowDefinition(id: string) {
  return useQuery({
    queryKey: ["chatbot", "flows", id, "definition"],
    queryFn: () => apiGet<ChatbotFlowVersion>(`/chatbot/flows/${id}/definition`),
    enabled: !!id,
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; descricao?: string; aiEnabled?: boolean }) =>
      apiPost<ChatbotFlow>("/chatbot/flows", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "flows"] }),
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; nome?: string; descricao?: string; aiEnabled?: boolean }) =>
      apiPatch<ChatbotFlow>(`/chatbot/flows/${id}`, input),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot", "flows"] });
      queryClient.invalidateQueries({ queryKey: ["chatbot", "flows", id] });
    },
  });
}

export function useDuplicateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<ChatbotFlow>(`/chatbot/flows/${id}/duplicate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "flows"] }),
  });
}

export function useSaveFlowDefinition(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (definition: FlowDefinition) => apiPatch<ChatbotFlowVersion>(`/chatbot/flows/${id}/definition`, definition),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "flows", id, "definition"] }),
  });
}

function useFlowAction(action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<ChatbotFlow>(`/chatbot/flows/${id}/${action}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["chatbot", "flows"] });
      queryClient.invalidateQueries({ queryKey: ["chatbot", "flows", id] });
      queryClient.invalidateQueries({ queryKey: ["chatbot", "flows", id, "definition"] });
    },
  });
}

export function usePublishFlow() {
  return useFlowAction("publish");
}
export function usePauseFlow() {
  return useFlowAction("pause");
}
export function useArchiveFlow() {
  return useFlowAction("archive");
}
export function useNewFlowVersion() {
  return useFlowAction("new-version");
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/chatbot/flows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "flows"] }),
  });
}

export function useKnowledgeBase(tipo?: string) {
  const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}` : "";
  return useQuery({
    queryKey: ["chatbot", "knowledge-base", tipo ?? ""],
    queryFn: () => apiGet<KnowledgeBaseItem[]>(`/chatbot/knowledge-base${qs}`),
  });
}

export function useCreateKnowledgeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      tipo: KnowledgeItemType;
      titulo: string;
      conteudo: string;
      campanha?: string;
      variacoes?: string[];
      palavraChave?: string;
      prioridade?: number;
    }) => apiPost<KnowledgeBaseItem>("/chatbot/knowledge-base", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "knowledge-base"] }),
  });
}

export function useUpdateKnowledgeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      ativo?: boolean;
      tipo?: KnowledgeItemType;
      titulo?: string;
      conteudo?: string;
      variacoes?: string[];
      palavraChave?: string;
      prioridade?: number;
    }) => apiPatch<KnowledgeBaseItem>(`/chatbot/knowledge-base/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "knowledge-base"] }),
  });
}

export function useDeleteKnowledgeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ status: "ok" }>(`/chatbot/knowledge-base/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chatbot", "knowledge-base"] }),
  });
}
