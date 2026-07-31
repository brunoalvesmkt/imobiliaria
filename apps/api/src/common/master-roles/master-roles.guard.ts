import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { MasterRole } from "@chatbot-saas/database";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { MASTER_ROLES_KEY } from "./master-roles.decorator";

/**
 * Autorização do Painel Master por papel (super_admin / financeiro /
 * suporte). Roda depois do MasterAuthGuard. Rotas sem `@RequireMasterRole`
 * ficam abertas a qualquer MasterUser autenticado.
 */
@Injectable()
export class MasterRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MasterRole[] | undefined>(MASTER_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const user = request.user;

    if (!user || user.type !== "master" || !user.masterRole) {
      throw new ForbiddenException("Acesso negado.");
    }

    if (!requiredRoles.includes(user.masterRole as MasterRole)) {
      throw new ForbiddenException(`Este papel (${user.masterRole}) não pode executar esta ação.`);
    }

    return true;
  }
}
