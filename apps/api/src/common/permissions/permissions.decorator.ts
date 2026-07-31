import { SetMetadata } from "@nestjs/common";
import type { PermissionAction } from "@chatbot-saas/database";

export const PERMISSIONS_KEY = "required_permission";

export interface RequiredPermission {
  module: string;
  action: PermissionAction;
}

export const RequirePermission = (module: string, action: PermissionAction): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, { module, action } satisfies RequiredPermission);
