import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { REQUIRED_MODULE_KEY } from "./require-module.decorator";

/**
 * Roda depois do TenantAuthGuard (já populou `request.user`) e antes do
 * PermissionsGuard. Bloqueia com 403 quando o módulo comercial exigido pela
 * rota não está ativo (`FeatureFlag.enabled`) para o tenant — ver
 * MODULE_DEPENDENCIES.md §2. Não depende do AsyncLocalStorage porque
 * guards rodam antes de interceptors no ciclo de vida do Nest.
 */
@Injectable()
export class ModuleActiveGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredModule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException("Acesso negado.");
    }

    const flag = await this.prisma.featureFlag.findUnique({
      where: { tenantId_module: { tenantId, module: requiredModule } },
    });

    if (!flag?.enabled) {
      throw new ForbiddenException(
        `O módulo "${requiredModule}" não está ativo para esta empresa.`,
      );
    }

    return true;
  }
}
