import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { MasterAuthGuard } from "../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../common/master-roles/master-roles.decorator";
import { AuditService } from "../common/audit/audit.service";

/** Mesma consulta de auditoria, mas sem restrição de tenant — só o Master super_admin enxerga entre empresas. */
@Controller("master/audit-log")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
@RequireMasterRole("super_admin")
export class MasterAuditLogController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query("tenantId") tenantId?: string,
    @Query("entity") entity?: string,
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ) {
    return this.audit.list({
      ...(tenantId ? { tenantId } : {}),
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(from ? { from: new Date(from) } : {}),
      ...(to ? { to: new Date(to) } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }
}
