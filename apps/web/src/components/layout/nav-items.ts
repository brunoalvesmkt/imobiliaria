import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

export interface NavItem {
  labelKey: DictionaryKey;
  href: string;
  /** undefined = sempre disponível (não é módulo comercial, ver MODULE_DEPENDENCIES.md §1). */
  module?: string;
  /** Fase do frontend em que a tela real chega — enquanto isso o item fica desabilitado. */
  builtInPhase: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.inicio", href: "/painel", builtInPhase: true },
  { labelKey: "nav.crm", href: "/painel/crm", module: "crm", builtInPhase: true },
  { labelKey: "nav.whatsapp", href: "/painel/whatsapp", module: "whatsapp", builtInPhase: true },
  { labelKey: "nav.atendimento", href: "/painel/atendimento", module: "atendimento", builtInPhase: true },
  { labelKey: "nav.chatbot", href: "/painel/chatbot", module: "chatbot", builtInPhase: true },
  { labelKey: "nav.automacao", href: "/painel/automacao", module: "automacao", builtInPhase: true },
  { labelKey: "nav.financeiro", href: "/painel/financeiro", builtInPhase: true },
  { labelKey: "nav.relatorios", href: "/painel/relatorios", builtInPhase: true },
  { labelKey: "nav.configuracoes", href: "/painel/configuracoes", builtInPhase: true },
];
