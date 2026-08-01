import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export interface NavItem {
  labelKey: DictionaryKey;
  href: string;
  /** Chave estável usada para reordenação (Master > Configurações para Empresas) — independe do módulo comercial. */
  key: string;
  /** undefined = sempre disponível (não é módulo comercial, ver MODULE_DEPENDENCIES.md §1). */
  module?: string;
  /** Fase do frontend em que a tela real chega — enquanto isso o item fica desabilitado. */
  builtInPhase: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.inicio", href: "/painel", key: "inicio", builtInPhase: true },
  { labelKey: "nav.crm", href: "/painel/crm", key: "crm", module: "crm", builtInPhase: true },
  { labelKey: "nav.whatsapp", href: "/painel/whatsapp", key: "whatsapp", module: "whatsapp", builtInPhase: true },
  { labelKey: "nav.atendimento", href: "/painel/atendimento", key: "atendimento", module: "atendimento", builtInPhase: true },
  { labelKey: "nav.chatbot", href: "/painel/chatbot", key: "chatbot", module: "chatbot", builtInPhase: true },
  { labelKey: "nav.automacao", href: "/painel/automacao", key: "automacao", module: "automacao", builtInPhase: true },
  { labelKey: "nav.financeiro", href: "/painel/financeiro", key: "financeiro", builtInPhase: true },
  { labelKey: "nav.relatorios", href: "/painel/relatorios", key: "relatorios", builtInPhase: true },
  { labelKey: "nav.configuracoes", href: "/painel/configuracoes", key: "configuracoes", builtInPhase: true },
];

/** Módulos reordenáveis pelo Master — todos exceto "Início", que fica sempre fixo no topo. */
export const REORDERABLE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.key !== "inicio");
