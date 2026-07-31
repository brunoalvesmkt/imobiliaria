import { SetMetadata } from "@nestjs/common";
import type { MasterRole } from "@chatbot-saas/database";

export const MASTER_ROLES_KEY = "required_master_roles";

/** Restringe uma rota do Painel Master a um subconjunto de papéis (ver PERMISSIONS_MATRIX.md §2). */
export const RequireMasterRole = (...roles: MasterRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(MASTER_ROLES_KEY, roles);
