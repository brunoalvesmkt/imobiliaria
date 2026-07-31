import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { BillingService } from "./billing.service";
import { SubscribeDto } from "./dto/subscribe.dto";
import { PayInvoiceDto } from "./dto/pay-invoice.dto";

@Controller("billing")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get("plans")
  @RequirePermission("configuracoes", "view")
  listPlans() {
    return this.service.listActivePlans();
  }

  @Get("subscription")
  @RequirePermission("configuracoes", "view")
  getSubscription() {
    return this.service.getCurrentSubscription(requireCurrentTenantId());
  }

  @Get("invoices")
  @RequirePermission("configuracoes", "view")
  listInvoices() {
    return this.service.listInvoices();
  }

  @Post("subscribe")
  @RequirePermission("configuracoes", "administer")
  subscribe(@Body() dto: SubscribeDto) {
    return this.service.subscribe(dto);
  }

  @Post("cancel")
  @RequirePermission("configuracoes", "administer")
  cancel() {
    return this.service.cancelSubscription();
  }

  @Post("invoices/:id/pay")
  @RequirePermission("configuracoes", "administer")
  payInvoice(@Param("id") id: string, @Body() dto: PayInvoiceDto) {
    return this.service.payInvoice(id, dto);
  }
}
