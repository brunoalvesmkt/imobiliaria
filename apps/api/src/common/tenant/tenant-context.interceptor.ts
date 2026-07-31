import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { Observable } from "rxjs";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { tenantContextStorage, type CurrentActor } from "./tenant-context";

/**
 * Roda depois dos guards de autenticação (interceptors executam após guards
 * no ciclo de vida do Nest). Popula o AsyncLocalStorage com o tenantId e o
 * ator resolvidos do JWT — nunca a partir de body/query/header livre do
 * cliente. Durante acesso assistido (impersonação), o ator registrado é o
 * MasterUser, não o usuário do tenant — é isso que faz o AuditService
 * atribuir a ação corretamente sem que cada service precise calcular isso.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedRequestUser }>();
    const user = request.user;

    if (!user || user.type !== "tenant" || !user.tenantId) {
      return next.handle();
    }

    const actor: CurrentActor = user.impersonation
      ? { actorId: user.impersonation.masterUserId, actorType: "master", onBehalfOfTenantId: user.tenantId }
      : { actorId: user.id, actorType: "tenant_user" };

    return new Observable((subscriber) => {
      tenantContextStorage.run({ tenantId: user.tenantId as string, actor }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
