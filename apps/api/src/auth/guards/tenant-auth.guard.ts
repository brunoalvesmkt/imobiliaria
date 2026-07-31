import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import type { AuthenticatedRequestUser } from "../jwt-payload.interface";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Além de autenticar o token tenant, bloqueia mutações quando a requisição
 * vem de uma sessão de acesso assistido (impersonação) em nível somente
 * leitura — ver PERMISSIONS_MATRIX.md §7. Como este guard é aplicado em
 * todo controller de tenant, cobre a restrição de leitura de forma
 * uniforme, sem depender de cada controller lembrar de checar.
 */
@Injectable()
export class TenantAuthGuard extends AuthGuard("jwt-tenant") {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const impersonation = request.user?.impersonation;

    // Encerrar a própria sessão (logout) nunca é bloqueado — não é uma
    // mutação nos dados do tenant, e bloqueá-lo impediria alguém em acesso
    // assistido somente leitura de sair pelo botão "Sair" (Fase 29, ver
    // DEVELOPMENT_PLAN.md).
    const isLogout = request.path.endsWith("/auth/tenant/logout");

    if (impersonation?.accessLevel === "read" && !isLogout && !SAFE_METHODS.has(request.method)) {
      throw new ForbiddenException(
        "Acesso assistido em modo somente leitura — esta ação de escrita não é permitida.",
      );
    }

    return true;
  }
}
