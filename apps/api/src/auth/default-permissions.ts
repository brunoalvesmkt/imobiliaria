import type { PermissionAction } from "@chatbot-saas/database";

const ALL_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "send",
  "transfer",
  "publish",
  "approve",
  "export",
  "administer",
  "view_sensitive",
];

/**
 * Módulos protegidos por guard nesta fase, além de "configuracoes"
 * (sempre disponível). O admin ganha permissão total de fábrica — o que
 * efetivamente libera o uso é o módulo estar ativo (`FeatureFlag`, ver
 * MODULE_DEPENDENCIES.md §2), checado separadamente pelo `ModuleActiveGuard`.
 * Cresce junto com os módulos comerciais introduzidos nas fases seguintes.
 */
const ADMIN_MODULES = ["configuracoes", "crm", "whatsapp", "atendimento", "chatbot", "automacao", "relatorios"];

/**
 * Permissões concedidas ao papel "admin" criado automaticamente no cadastro
 * da empresa (ver PERMISSIONS_MATRIX.md §3 — "admin: acesso total aos
 * módulos ativos e a Configurações").
 */
export const ADMIN_DEFAULT_PERMISSIONS: ReadonlyArray<{ module: string; action: PermissionAction }> = ADMIN_MODULES.flatMap(
  (module) => ALL_ACTIONS.map((action) => ({ module, action })),
);
