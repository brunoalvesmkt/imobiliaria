import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { PERMISSIONS_KEY, type RequiredPermission } from "./permissions.decorator";

/**
 * Autorização RBAC aplicada sempre no backend (ver PERMISSIONS_MATRIX.md §6).
 * Roda depois do TenantAuthGuard — assume que `request.user` já foi
 * populado pela estratégia JWT. Nunca confia em nada vindo do cliente além
 * do token já validado.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const user = request.user;

    if (!user || user.type !== "tenant" || !user.tenantId || !user.roleId) {
      throw new ForbiddenException("Acesso negado.");
    }

    const permission = await this.prisma.permission.findFirst({
      where: {
        roleId: user.roleId,
        module: required.module,
        action: required.action,
        // Perfil inativo perde todas as permissões efetivas, mesmo com as
        // linhas de Permission ainda existindo — usuários já vinculados ao
        // perfil não são desvinculados automaticamente (ver Role.ativo).
        role: { tenantId: user.tenantId, ativo: true },
      },
    });

    if (!permission) {
      throw new ForbiddenException(
        `Você não tem permissão para "${required.action}" em "${required.module}".`,
      );
    }

    return true;
  }
}
