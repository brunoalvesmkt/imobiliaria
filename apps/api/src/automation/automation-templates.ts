import type { DomainEventName } from "../common/events/domain-event.types";
import { TRIGGER_CATEGORY, TRIGGER_REQUIRED_MODULE, type AutomationAction, type AutomationCategory } from "./automation-definition.types";

/**
 * Biblioteca de modelos prontos (Fase D) — catálogo estático, no mesmo
 * espírito do catálogo de gatilhos/ações da Fase A (`buildAutomationCatalog`):
 * não é uma tabela por tenant, é código, filtrado pelos módulos ativos na
 * hora de listar. Usa só os tipos de ação que não dependem de um ID
 * específico do tenant (`stageId`/`flowId` só existem depois de o tenant
 * criar seus próprios funis/fluxos) — assim a ativação é sempre 1 clique,
 * sem etapa de "escolher para qual funil/fluxo". Nome/descrição ficam nas
 * dicionárias i18n (`automation.templates.<id>.nome`/`.descricao`), não
 * aqui, para não fixar texto em português no backend.
 */
export interface AutomationTemplate {
  id: string;
  gatilhoTipo: DomainEventName;
  gatilhoParametros?: Record<string, number>;
  acoes: AutomationAction[];
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "welcome_message",
    gatilhoTipo: "conversation.created",
    acoes: [{ tipo: "send_message", texto: "Olá! Obrigado por entrar em contato. Em breve alguém da nossa equipe vai te atender." }],
  },
  {
    id: "hot_lead_followup",
    gatilhoTipo: "contact.lead_hot",
    acoes: [{ tipo: "create_task", titulo: "Ligar para lead quente", tipoTarefa: "ligacao", horasParaVencer: 2 }],
  },
  {
    id: "tag_won_opportunity",
    gatilhoTipo: "opportunity.won",
    acoes: [{ tipo: "apply_tag", tag: "cliente" }],
  },
  {
    id: "overdue_task_review",
    gatilhoTipo: "crm_task.overdue",
    acoes: [{ tipo: "create_task", titulo: "Revisar tarefa atrasada", tipoTarefa: "revisao", horasParaVencer: 1 }],
  },
  {
    id: "due_soon_tag",
    gatilhoTipo: "crm_task.due_soon",
    gatilhoParametros: { horasAntecedencia: 4 },
    acoes: [{ tipo: "apply_tag", tag: "tarefa-urgente" }],
  },
  {
    id: "overdue_invoice_task",
    gatilhoTipo: "invoice.overdue",
    acoes: [{ tipo: "create_task", titulo: "Cobrar fatura vencida", tipoTarefa: "cobranca", horasParaVencer: 4 }],
  },
  {
    id: "thank_you_payment",
    gatilhoTipo: "invoice.paid",
    acoes: [{ tipo: "schedule_followup", delayMinutes: 60, texto: "Muito obrigado pelo pagamento! Qualquer dúvida, estamos à disposição." }],
  },
];

export interface AutomationTemplateCatalogEntry extends AutomationTemplate {
  categoria: AutomationCategory | null;
  available: boolean;
}

/** Filtra os modelos pelos módulos ativos do tenant, mesmo critério de disponibilidade já usado por `buildAutomationCatalog` para os gatilhos. */
export function buildAutomationTemplateCatalog(activeModules: Set<string>): AutomationTemplateCatalogEntry[] {
  return AUTOMATION_TEMPLATES.map((template) => {
    const requiredModule = TRIGGER_REQUIRED_MODULE[template.gatilhoTipo] ?? null;
    return {
      ...template,
      categoria: TRIGGER_CATEGORY[template.gatilhoTipo],
      available: !requiredModule || activeModules.has(requiredModule),
    };
  });
}
