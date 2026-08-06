import type { DomainEventName } from "../common/events/domain-event.types";

/**
 * Formato de condições/ações de uma Automação — mesmo espírito de JSON
 * estruturado do Chatbot (ver flow-definition.types.ts): fácil de
 * versionar, sem exigir uma tabela por tipo de ação.
 */

export interface AutomationCondition {
  campo: string; // caminho dentro do payload do evento (ex.: "opportunity.valor")
  operador: "equals" | "contains" | "exists" | "not_exists" | "greater_than" | "less_than";
  valor?: string;
}

export type AutomationAction =
  | { tipo: "send_message"; texto: string }
  | { tipo: "create_task"; titulo: string; tipoTarefa: string; horasParaVencer?: number }
  | { tipo: "apply_tag"; tag: string }
  | { tipo: "remove_tag"; tag: string }
  | { tipo: "update_field"; campo: string; valor: string }
  | { tipo: "move_opportunity_stage"; stageId: string }
  | { tipo: "create_opportunity"; stageId: string }
  | { tipo: "start_chatbot"; flowId: string }
  | { tipo: "send_webhook"; url: string; metodo?: "GET" | "POST" }
  | { tipo: "schedule_followup"; delayMinutes: number; texto: string; sequenciaIndex?: number }
  | { tipo: "wait"; delayMinutes: number };

export type ActionType = AutomationAction["tipo"];

const KNOWN_ACTION_TYPES = [
  "send_message",
  "create_task",
  "apply_tag",
  "remove_tag",
  "update_field",
  "move_opportunity_stage",
  "create_opportunity",
  "start_chatbot",
  "send_webhook",
  "schedule_followup",
  "wait",
];

export interface AutomationValidationError {
  message: string;
}

export function validateAutomationActions(acoes: unknown): AutomationValidationError[] {
  const errors: AutomationValidationError[] = [];
  if (!Array.isArray(acoes) || acoes.length === 0) {
    return [{ message: "A automação precisa ter ao menos uma ação." }];
  }

  for (const [index, acao] of acoes.entries()) {
    const tipo = (acao as { tipo?: unknown }).tipo;
    if (typeof tipo !== "string" || !KNOWN_ACTION_TYPES.includes(tipo)) {
      errors.push({ message: `Ação #${index + 1}: tipo "${String(tipo)}" desconhecido.` });
      continue;
    }
    if (tipo === "wait") {
      const delayMinutes = (acao as { delayMinutes?: unknown }).delayMinutes;
      if (typeof delayMinutes !== "number" || !Number.isFinite(delayMinutes) || delayMinutes <= 0) {
        errors.push({ message: `Ação #${index + 1}: "Esperar" exige um tempo de espera (minutos) maior que zero.` });
      }
    }
  }

  return errors;
}

/** Chave numérica exigida em `Automation.gatilhoParametros` para cada gatilho baseado em tempo (ver automation-data-triggers.scheduler.ts) — os demais gatilhos não usam esse campo. */
export const TRIGGER_PARAM_KEY: Partial<Record<DomainEventName, string>> = {
  "crm_task.due_soon": "horasAntecedencia",
  "opportunity.stage_stagnant": "diasParado",
};

export function validateTriggerParams(gatilhoTipo: DomainEventName, gatilhoParametros: unknown): AutomationValidationError[] {
  const requiredKey = TRIGGER_PARAM_KEY[gatilhoTipo];
  if (!requiredKey) {
    return [];
  }
  const params = gatilhoParametros as Record<string, unknown> | null | undefined;
  const value = params?.[requiredKey];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return [{ message: `Este gatilho exige o parâmetro "${requiredKey}" (número maior que zero).` }];
  }
  return [];
}

function readPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

export function evaluateConditions(data: Record<string, unknown>, condicoes: AutomationCondition[] | null | undefined): boolean {
  if (!condicoes || condicoes.length === 0) {
    return true;
  }

  return condicoes.every((condicao) => {
    const value = readPath(data, condicao.campo);
    switch (condicao.operador) {
      case "exists":
        return value !== undefined && value !== null && value !== "";
      case "not_exists":
        return value === undefined || value === null || value === "";
      case "contains":
        return typeof value === "string" && typeof condicao.valor === "string" && value.includes(condicao.valor);
      case "greater_than":
      case "less_than": {
        const numValue = Number(value);
        const numLimite = Number(condicao.valor);
        if (Number.isNaN(numValue) || Number.isNaN(numLimite)) return false;
        return condicao.operador === "greater_than" ? numValue > numLimite : numValue < numLimite;
      }
      case "equals":
      default:
        return String(value) === condicao.valor;
    }
  });
}

// ---------------------------------------------------------------------------
// Catálogo de gatilhos/ações (Fase A do redesenho do módulo Automação) —
// fonte única de verdade consumida por `AutomationsService.getCatalog()`
// (GET /automation/rules/catalog). Antes desta fase, o frontend duplicava
// manualmente `DOMAIN_EVENTS`/`TRIGGER_FIELDS`/`ACTION_TYPES` em
// `apps/web/src/lib/automation.ts` e ficou desatualizado (8 dos 21 gatilhos
// existentes nunca foram expostos na tela) — este catálogo elimina essa
// duplicação e permite crescer a lista de gatilhos/ações só aqui, sem
// reconstruir o módulo.
// ---------------------------------------------------------------------------

/** Limite de profundidade na corrente de automações que se disparam entre si (ver automation-chain-context.ts) — acima disso, a execução é bloqueada como "loop_blocked" em vez de enfileirada. */
export const MAX_AUTOMATION_CHAIN_DEPTH = 5;

export const AUTOMATION_CATEGORIES = ["atendimento", "crm", "tarefas", "data"] as const;
export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[number];

/**
 * Categoria de organização de cada gatilho disponível como automação — usada
 * para filtrar o seletor de gatilho quando o usuário escolhe um "tipo de
 * automação" no formulário. Só entram aqui os gatilhos que o módulo
 * Automação realmente expõe — os eventos de billing (`invoice.*`/
 * `subscription.*`) não entram: a plataforma usa Automação só para
 * atendimento/CRM/tarefas, não para cobrança. Os dois gatilhos baseados em
 * varredura por tempo (`crm_task.due_soon`, `opportunity.stage_stagnant`, ver
 * automation-data-triggers.scheduler.ts) ficam em "data".
 */
export const TRIGGER_CATEGORY: Partial<Record<DomainEventName, AutomationCategory>> = {
  "conversation.created": "atendimento",
  "conversation.closed": "atendimento",
  "conversation.transferred": "atendimento",
  "conversation.analysis_completed": "atendimento",
  "message.received": "atendimento",
  "whatsapp_number.connected": "atendimento",
  "whatsapp_number.disconnected": "atendimento",
  "contact.created": "crm",
  "contact.lead_hot": "crm",
  "contact.imported": "crm",
  "contact.merged": "crm",
  "opportunity.stage_changed": "crm",
  "opportunity.won": "crm",
  "opportunity.lost": "crm",
  "opportunity.responsavel_changed": "crm",
  "crm_task.created": "tarefas",
  "crm_task.overdue": "tarefas",
  "crm_task.completed": "tarefas",
  "crm_task.reassigned": "tarefas",
  "chatbot.flow.completed": "atendimento",
  "chatbot.flow.abandoned": "atendimento",
  "chatbot.flow.transferred": "atendimento",
  "crm_task.due_soon": "data",
  "opportunity.stage_stagnant": "data",
};

/** Módulo do tenant que precisa estar ativo para o gatilho aparecer como opção — sem entrada = sempre disponível (ex.: billing). */
export const TRIGGER_REQUIRED_MODULE: Partial<Record<DomainEventName, string>> = {
  "conversation.created": "atendimento",
  "conversation.closed": "atendimento",
  "conversation.transferred": "atendimento",
  "conversation.analysis_completed": "atendimento",
  "message.received": "whatsapp",
  "whatsapp_number.connected": "whatsapp",
  "whatsapp_number.disconnected": "whatsapp",
  "contact.created": "crm",
  "contact.lead_hot": "crm",
  "opportunity.stage_changed": "crm",
  "opportunity.won": "crm",
  "opportunity.lost": "crm",
  "crm_task.created": "crm",
  "crm_task.overdue": "crm",
  "crm_task.completed": "crm",
  "crm_task.reassigned": "crm",
  "crm_task.due_soon": "crm",
  "contact.imported": "crm",
  "contact.merged": "crm",
  "opportunity.responsavel_changed": "crm",
  "opportunity.stage_stagnant": "crm",
  "chatbot.flow.completed": "chatbot",
  "chatbot.flow.abandoned": "chatbot",
  "chatbot.flow.transferred": "chatbot",
};

/** Módulo do tenant que precisa estar ativo para a ação aparecer como opção — mesmo mapeamento já checado em runtime pelo `automation.processor.ts` (ver `move_opportunity_stage`); aqui só evita oferecer a opção na hora de montar a automação. */
export const ACTION_REQUIRED_MODULE: Partial<Record<ActionType, string>> = {
  send_message: "whatsapp",
  schedule_followup: "whatsapp",
  move_opportunity_stage: "crm",
  create_opportunity: "crm",
  start_chatbot: "chatbot",
};

/**
 * Campos disponíveis em `data` para cada gatilho (ver `DomainEventsService.emit`
 * correspondente em cada módulo emissor) — a Automação só sabe filtrar por
 * esses nomes técnicos exatos. Portado de `apps/web/src/lib/automation.ts`
 * (fonte única agora é o backend).
 */
export const TRIGGER_FIELDS: Record<DomainEventName, string[]> = {
  "conversation.created": ["conversationId", "origem", "contatoNumero"],
  "message.received": ["conversationId", "conteudo", "direction"],
  "opportunity.stage_changed": ["opportunityId", "stageId", "stageIdAnterior"],
  "opportunity.won": ["opportunityId", "motivo", "valor"],
  "opportunity.lost": ["opportunityId", "motivo", "valor"],
  "crm_task.created": ["taskId", "tipo", "titulo"],
  "chatbot.flow.completed": ["chatbotExecutionId", "chatbotFlowId"],
  "chatbot.flow.abandoned": ["chatbotExecutionId", "chatbotFlowId"],
  "chatbot.flow.transferred": ["chatbotExecutionId", "chatbotFlowId"],
  "invoice.paid": ["invoiceId", "subscriptionId", "planId", "valor"],
  "invoice.overdue": ["invoiceId", "subscriptionId"],
  "subscription.activated": ["subscriptionId", "planId"],
  "subscription.cancelled": ["subscriptionId", "motivo"],
  "contact.created": ["contactId", "origemId"],
  "conversation.closed": ["conversationId"],
  "conversation.transferred": ["conversationId", "filaId", "atendenteId"],
  "whatsapp_number.connected": ["whatsAppNumberId"],
  "whatsapp_number.disconnected": ["whatsAppNumberId"],
  "crm_task.overdue": ["taskId", "tipo", "titulo"],
  "contact.lead_hot": ["contactId", "score"],
  "conversation.analysis_completed": ["conversationId", "nota"],
  "crm_task.completed": ["taskId", "tipo", "titulo"],
  "crm_task.reassigned": ["taskId", "responsavelId", "responsavelIdAnterior"],
  "opportunity.responsavel_changed": ["opportunityId", "responsavelId", "responsavelIdAnterior"],
  "contact.imported": ["quantidade", "origem"],
  "contact.merged": ["contatoSobrevivente", "contatoMesclado"],
  "crm_task.due_soon": ["taskId", "tipo", "titulo"],
  "opportunity.stage_stagnant": ["opportunityId", "stageId", "diasParado"],
};

/** Campos cujo valor é o ID de uma entidade com nome — o frontend mostra um seletor por nome em vez de um campo de texto livre. */
export const ID_FIELD_KIND: Record<string, "stage" | "flow" | "origin"> = {
  stageId: "stage",
  stageIdAnterior: "stage",
  chatbotFlowId: "flow",
  origemId: "origin",
};

export interface AutomationCatalogTrigger {
  event: DomainEventName;
  category: AutomationCategory | null;
  requiredModule: string | null;
  fields: string[];
  available: boolean;
}

export interface AutomationCatalogAction {
  tipo: ActionType;
  requiredModule: string | null;
  available: boolean;
}

/** Monta o catálogo já filtrado pelos módulos ativos do tenant (`activeModules`) — usado por `AutomationsService.getCatalog()`. */
export function buildAutomationCatalog(activeModules: Set<string>): {
  categories: readonly AutomationCategory[];
  triggers: AutomationCatalogTrigger[];
  actions: AutomationCatalogAction[];
} {
  const triggers: AutomationCatalogTrigger[] = (Object.keys(TRIGGER_CATEGORY) as DomainEventName[]).map((event) => {
    const requiredModule = TRIGGER_REQUIRED_MODULE[event] ?? null;
    return {
      event,
      category: TRIGGER_CATEGORY[event] ?? null,
      requiredModule,
      fields: TRIGGER_FIELDS[event] ?? [],
      available: !requiredModule || activeModules.has(requiredModule),
    };
  });

  const actions: AutomationCatalogAction[] = KNOWN_ACTION_TYPES.map((tipo) => {
    const requiredModule = ACTION_REQUIRED_MODULE[tipo as ActionType] ?? null;
    return {
      tipo: tipo as ActionType,
      requiredModule,
      available: !requiredModule || activeModules.has(requiredModule),
    };
  });

  return { categories: AUTOMATION_CATEGORIES, triggers, actions };
}
