import { Injectable } from "@nestjs/common";
import type { AuditActorType, Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { getCurrentActor, getCurrentTenantId } from "../tenant/tenant-context";

export interface RecordAuditEntryInput {
  /** Se omitido, resolvido do contexto atual (`getCurrentActor()`) — cobre corretamente o caso de impersonação. */
  actorId?: string | undefined;
  actorType?: AuditActorType | undefined;
  action: string;
  entity: string;
  entityId?: string | undefined;
  previousData?: Prisma.InputJsonValue | undefined;
  newData?: Prisma.InputJsonValue | undefined;
  ip?: string | undefined;
  userAgent?: string | undefined;
  onBehalfOfTenantId?: string | undefined;
  /** Só necessário quando não houver tenant no contexto atual (ex.: ação do Master fora de impersonação). */
  tenantId?: string | null;
}

/**
 * Serviço central de auditoria (ver SECURITY.md §6). Toda ação da lista
 * obrigatória deve chamar `record` — nunca escrever diretamente na tabela
 * `AuditLog` fora deste serviço, para manter o formato consistente.
 *
 * `actorId`/`actorType`/`onBehalfOfTenantId` podem ser omitidos: nesse caso
 * são resolvidos do `CurrentActor` populado pelo `TenantContextInterceptor`
 * a partir do JWT autenticado — inclusive durante acesso assistido
 * (impersonação), quando o ator real é o MasterUser, não o usuário do
 * tenant (ver PERMISSIONS_MATRIX.md §7).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput): Promise<void> {
    const tenantId = input.tenantId !== undefined ? input.tenantId : (getCurrentTenantId() ?? null);
    const contextActor = getCurrentActor();

    const actorId = input.actorId ?? contextActor?.actorId;
    const actorType = input.actorType ?? contextActor?.actorType;
    if (!actorId || !actorType) {
      throw new Error(
        "AuditService.record: actorId/actorType não informados e nenhum ator resolvido no contexto atual.",
      );
    }

    const onBehalfOfTenantId = input.onBehalfOfTenantId ?? contextActor?.onBehalfOfTenantId;

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        actorType,
        onBehalfOfTenantId: onBehalfOfTenantId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        ...(input.previousData !== undefined ? { previousData: input.previousData } : {}),
        ...(input.newData !== undefined ? { newData: input.newData } : {}),
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}
