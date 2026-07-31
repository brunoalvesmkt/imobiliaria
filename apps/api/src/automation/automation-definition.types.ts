/**
 * Formato de condições/ações de uma Automação — mesmo espírito de JSON
 * estruturado do Chatbot (ver flow-definition.types.ts): fácil de
 * versionar, sem exigir uma tabela por tipo de ação.
 */

export interface AutomationCondition {
  campo: string; // caminho dentro do payload do evento (ex.: "opportunity.valor")
  operador: "equals" | "contains" | "exists" | "not_exists";
  valor?: string;
}

export type AutomationAction =
  | { tipo: "send_message"; texto: string }
  | { tipo: "create_task"; titulo: string; tipoTarefa: string; horasParaVencer?: number }
  | { tipo: "apply_tag"; tag: string }
  | { tipo: "remove_tag"; tag: string }
  | { tipo: "update_field"; campo: string; valor: string }
  | { tipo: "move_opportunity_stage"; stageId: string }
  | { tipo: "start_chatbot"; flowId: string }
  | { tipo: "send_webhook"; url: string }
  | { tipo: "schedule_followup"; delayMinutes: number; texto: string; sequenciaIndex?: number };

const KNOWN_ACTION_TYPES = [
  "send_message",
  "create_task",
  "apply_tag",
  "remove_tag",
  "update_field",
  "move_opportunity_stage",
  "start_chatbot",
  "send_webhook",
  "schedule_followup",
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
    }
  }

  return errors;
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
      case "equals":
      default:
        return String(value) === condicao.valor;
    }
  });
}
