import { IsIn } from "class-validator";

/** Mesmos módulos usados em `@RequireModule`/`@RequirePermission` nos controllers (ver PERMISSIONS_MATRIX.md). */
export const PERMISSION_MODULES = [
  "crm",
  "whatsapp",
  "atendimento",
  "chatbot",
  "automacao",
  "relatorios",
  "configuracoes",
] as const;

/**
 * Subconjunto de `PermissionAction` (schema.prisma) atribuível ao montar um
 * papel customizado — as demais ações do enum (send/transfer/publish/
 * approve/export/view_sensitive) são concedidas via código em fluxos
 * específicos, não fazem sentido como checkbox genérico por módulo.
 * `PermissionAction` só é exportado como type do pacote database (ver
 * `packages/database/src/index.ts`), por isso a lista literal aqui em vez
 * de `@IsEnum`.
 */
export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "administer"] as const;

export class PermissionInputDto {
  @IsIn(PERMISSION_MODULES)
  module!: (typeof PERMISSION_MODULES)[number];

  @IsIn(PERMISSION_ACTIONS)
  action!: (typeof PERMISSION_ACTIONS)[number];
}
