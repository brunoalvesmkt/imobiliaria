/**
 * Formato do grafo de um fluxo (Flow Builder). `position` existe só para a
 * futura tela visual (React Flow) — a execução (ChatbotEngineService) nunca
 * olha para ela.
 *
 * Cobertura de tipos de card do prompt mestre (seção 11.3): "resposta" e
 * "captura de dados" são propriedades do node `question` (não cards
 * separados); "mídia"/"documento"/"localização" são o campo `tipo` do node
 * `message`; "espera curta" é `delayMs` em `message`; "retorno" acontece
 * automaticamente quando um `end` é alcançado dentro de um subfluxo. `ai`
 * (rotulado "IA" na UI) e `knowledge_query` ("Consulta à Base") chamam um
 * provedor de IA real (Claude/ChatGPT/Gemini, ver apps/api/src/ai/) — só
 * permitidos em fluxos com `aiEnabled: true` (checado em flows.service.ts,
 * não aqui: esta validação é puramente estrutural do grafo).
 */

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

/** Tipos de card cujo card só faz sentido "esperando" resposta do cliente — únicos elegíveis ao timeout de reengajamento. */
export const TIMEOUT_NODE_TYPES: FlowNodeType[] = ["question", "menu"];

export type TimeoutUnit = "minutes" | "hours" | "days";

/**
 * Saídas reservadas (`FlowEdge.sourceHandle`) da reativação por falta de resposta — configuradas
 * por conexão visual no canvas, igual às demais saídas nomeadas (`menu`/`condition`), nunca por
 * um seletor de destino. `TIMEOUT_HANDLE` ("Não respondeu") é obrigatória quando `timeoutEnabled`;
 * `TIMEOUT_LIMIT_HANDLE` ("Limite de tentativas atingido") é opcional — sem conexão, o motor encerra
 * a execução ao esgotar as tentativas.
 */
export const TIMEOUT_HANDLE = "timeout";
export const TIMEOUT_LIMIT_HANDLE = "timeout_limit";

export function timeoutUnitToMs(quantidade: number, unidade: TimeoutUnit): number {
  const perUnit: Record<TimeoutUnit, number> = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 };
  return quantidade * perUnit[unidade];
}

/** Tipos de card que exigem `flow.aiEnabled === true` para serem publicados. */
export const AI_NODE_TYPES: FlowNodeType[] = ["ai", "knowledge_query"];

export type ValidationType = "texto" | "numero" | "email" | "cpf" | "cnpj" | "telefone" | "data";

export interface MessageNodeData {
  tipo?: "text" | "image" | "audio" | "video" | "document" | "location";
  texto: string;
  /** URL pública informada manualmente — ignorada quando `arquivoId` está presente (arquivo enviado tem prioridade). */
  midiaUrl?: string;
  /** Arquivo enviado via upload (apps/api/src/files) — a URL de download é sempre resolvida na hora do envio (assinada, expira em minutos), nunca gravada no fluxo. */
  arquivoId?: string;
  delayMs?: number;
}

export interface QuestionNodeData {
  texto: string;
  variavel: string; // chave onde a resposta é gravada em contextData
  validacao?: ValidationType;
  salvarNoCrm?: string; // nome do campo em Contact.customFields, se preenchido
  mensagemErro?: string;
  maxTentativas?: number; // default 3
  /** Pontos somados ao Lead Score do contato quando esta pergunta é respondida validamente (prompt mestre §4). Pode ser negativo. */
  pontuacao?: number;
  /**
   * Reativação por falta de resposta (ver TIMEOUT_NODE_TYPES/TIMEOUT_HANDLE) — quando ativada,
   * o card exige uma conexão de saída "Não respondeu" (`sourceHandle: TIMEOUT_HANDLE`) no canvas;
   * a saída "Limite atingido" (`TIMEOUT_LIMIT_HANDLE`) é opcional.
   */
  timeoutEnabled?: boolean;
  timeoutQuantidade?: number;
  timeoutUnidade?: TimeoutUnit;
  /** Nº máximo de reativações (reenvios) antes de seguir pela saída "Limite atingido" (ou encerrar, se não conectada). Default: 1. */
  timeoutMaxTentativas?: number;
}

export interface MenuOption {
  chave: string;
  texto: string;
  /** Pontos somados ao Lead Score do contato quando esta opção é escolhida (prompt mestre §4). Pode ser negativo. */
  pontuacao?: number;
}

export interface MenuNodeData {
  texto: string;
  opcoes: MenuOption[];
  variavel?: string;
  mensagemErro?: string;
  maxTentativas?: number;
  /** Reativação por falta de resposta — ver QuestionNodeData. */
  timeoutEnabled?: boolean;
  timeoutQuantidade?: number;
  timeoutUnidade?: TimeoutUnit;
  timeoutMaxTentativas?: number;
}

export interface ConditionNodeData {
  campo: string; // caminho em contextData, ex.: "idade"
  operador: "equals" | "contains" | "exists" | "not_exists";
  valor?: string;
}

export interface SubflowNodeData {
  subflowId: string;
}

export interface TransferNodeData {
  queueId?: string;
  tenantUserId?: string;
}

export interface AiNodeData {
  /** "anthropic" | "openai" | "google" — ver AI_PROVIDER_NAMES em apps/api/src/ai/. */
  provider: string;
  prompt: string;
  /** Se definido, a resposta da IA é gravada em contextData.answers[variavel] (disponível para condições/subfluxos seguintes). */
  variavel?: string;
}

export interface KnowledgeQueryNodeData {
  provider: string;
  /** Filtra a busca na Base de Conhecimento por tipo (ex.: "faq", "produto") — vazio busca em todos. */
  tipo?: string;
  variavel?: string;
}

/**
 * Cria (ou reaproveita, se já existir uma aberta) uma Oportunidade do CRM
 * para o contato desta conversa no funil/etapa indicados — "adicionar o
 * lead ao funil" direto do fluxo do chatbot, sem precisar de Automação.
 * Requer o módulo CRM ativo no tenant (mesma regra de saveAnswerToCrm).
 */
export interface CrmStageNodeData {
  funnelId: string;
  stageId: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  /** Usado por `condition` ("true"/"false") e `menu` (chave da opção escolhida). */
  sourceHandle?: string;
  target: string;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowValidationError {
  message: string;
  nodeId?: string;
}

const TERMINAL_TYPES: FlowNodeType[] = ["end", "transfer"];

export function validateFlowDefinition(definition: FlowDefinition): FlowValidationError[] {
  const errors: FlowValidationError[] = [];
  const nodesById = new Map(definition.nodes.map((n) => [n.id, n]));

  const startNodes = definition.nodes.filter((n) => n.type === "start");
  if (startNodes.length !== 1) {
    errors.push({ message: `O fluxo deve ter exatamente 1 card de início (encontrado: ${startNodes.length}).` });
  }

  for (const edge of definition.edges) {
    if (!nodesById.has(edge.source)) {
      errors.push({ message: `Conexão referencia um card de origem inexistente: "${edge.source}".` });
    }
    if (!nodesById.has(edge.target)) {
      errors.push({ message: `Conexão referencia um card de destino inexistente: "${edge.target}".` });
    }
  }

  // Reativação por falta de resposta (question/menu): quando ativada, exige tempo configurado e
  // a saída "Não respondeu" conectada — a saída "Limite atingido" é opcional.
  for (const node of definition.nodes) {
    if (!TIMEOUT_NODE_TYPES.includes(node.type)) continue;
    const data = node.data as { timeoutEnabled?: boolean; timeoutQuantidade?: number } | undefined;
    if (!data?.timeoutEnabled) continue;

    if (!data.timeoutQuantidade || data.timeoutQuantidade <= 0) {
      errors.push({
        message: `Card "${node.id}": configure o tempo de espera da reativação por falta de resposta.`,
        nodeId: node.id,
      });
    }
    const hasTimeoutEdge = definition.edges.some((e) => e.source === node.id && e.sourceHandle === TIMEOUT_HANDLE);
    if (!hasTimeoutEdge) {
      errors.push({
        message: `Card "${node.id}": a saída "Não respondeu" precisa estar conectada a um card.`,
        nodeId: node.id,
      });
    }
  }

  // Alcançabilidade a partir do start — nós órfãos (inalcançáveis) são inválidos.
  if (startNodes.length === 1 && startNodes[0]) {
    const outgoing = new Map<string, FlowEdge[]>();
    for (const edge of definition.edges) {
      const list = outgoing.get(edge.source) ?? [];
      list.push(edge);
      outgoing.set(edge.source, list);
    }

    const visited = new Set<string>();
    const queue = [startNodes[0].id];
    while (queue.length > 0) {
      const currentId = queue.shift() as string;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      for (const edge of outgoing.get(currentId) ?? []) {
        if (!visited.has(edge.target)) queue.push(edge.target);
      }
    }

    for (const node of definition.nodes) {
      if (!visited.has(node.id)) {
        errors.push({ message: `Card inalcançável a partir do início: "${node.id}".`, nodeId: node.id });
      }
    }

    // Todo nó não-terminal precisa de ao menos uma saída "principal" (evita becos sem saída) —
    // as saídas reservadas de timeout não contam, senão um question/menu só com "Não respondeu"
    // conectado passaria na validação e quebraria em tempo de execução (ver singleOutgoing).
    for (const node of definition.nodes) {
      if (TERMINAL_TYPES.includes(node.type)) continue;
      const mainOutgoing = (outgoing.get(node.id) ?? []).filter(
        (e) => e.sourceHandle !== TIMEOUT_HANDLE && e.sourceHandle !== TIMEOUT_LIMIT_HANDLE,
      );
      if (mainOutgoing.length === 0) {
        errors.push({ message: `Card "${node.id}" (${node.type}) não tem nenhuma conexão de saída.`, nodeId: node.id });
      }
    }

    // Precisa existir ao menos um caminho do início até um card terminal
    // (end/transfer) — sem isso, todo caminho é um ciclo sem saída (loop
    // infinito garantido em tempo de execução).
    const hasPathToTerminal = definition.nodes.some(
      (n) => TERMINAL_TYPES.includes(n.type) && visited.has(n.id),
    );
    if (!hasPathToTerminal) {
      errors.push({ message: "Nenhum caminho do início leva a um card de encerramento/transferência — o fluxo é um ciclo sem saída." });
    }
  }

  return errors;
}
