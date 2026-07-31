import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MasterAuthGuard } from "../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../common/master-roles/master-roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { BillingService } from "./billing.service";
import { RefundInvoiceDto } from "./dto/refund-invoice.dto";

function actorFrom(user: AuthenticatedRequestUser, req: Request) {
  return { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") };
}

/**
 * Rotas do painel Master — diferente de `BillingController` (tenant), aqui
 * não há um tenant autenticado na requisição, então `BillingService` recebe
 * `tenantId` explicitamente por parâmetro em vez de ler do contexto
 * (`requireCurrentTenantId`), e usa `PrismaService` direto (não o wrapper
 * `TenantScopedPrismaService`, que exige o contexto populado).
 */
@Controller("master/billing")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
@RequireMasterRole("super_admin", "financeiro")
export class MasterBillingController {
  constructor(private readonly service: BillingService) {}

  @Post("tenants/:tenantId/invoices/:invoiceId/mark-paid")
  markPaid(
    @Param("tenantId") tenantId: string,
    @Param("invoiceId") invoiceId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.markPaidManually(tenantId, invoiceId, actorFrom(user, req));
  }

  @Post("tenants/:tenantId/invoices/:invoiceId/refund")
  refund(
    @Param("tenantId") tenantId: string,
    @Param("invoiceId") invoiceId: string,
    @Body() dto: RefundInvoiceDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.refundInvoice(tenantId, invoiceId, dto.motivo, actorFrom(user, req));
  }

  @Post("run-renewal-check")
  runRenewalCheck() {
    return this.service.runRenewalCheck();
  }
}
