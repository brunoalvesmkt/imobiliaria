import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { AuditService } from "../common/audit/audit.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";

/**
 * Histórico e Auditoria (documento de alterações, item 20) — o registro em
 * si já existia desde a Fase 1.6 (AuditService.record, chamado por toda
 * ação relevante), mas nunca havia uma tela nem endpoint para consultá-lo.
 * Sempre restrito ao tenant atual — nunca aceita `tenantId` do cliente.
 */
@Controller("audit-log")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class AuditLogController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission("configuracoes", "view")
  list(
    @Query("entity") entity?: string,
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.audit.list({
      tenantId: requireCurrentTenantId(),
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }
}
