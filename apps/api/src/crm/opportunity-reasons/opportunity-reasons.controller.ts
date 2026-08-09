import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { OpportunityReasonsService } from "./opportunity-reasons.service";
import { CreateOpportunityReasonDto } from "./dto/create-opportunity-reason.dto";
import { UpdateOpportunityReasonDto } from "./dto/update-opportunity-reason.dto";

@Controller("crm/opportunity-reasons")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class OpportunityReasonsController {
  constructor(private readonly service: OpportunityReasonsService) {}

  @Get()
  @RequirePermission("crm", "view")
  list(@Query("tipo") tipo: "won" | "lost" | undefined) {
    return this.service.list(tipo);
  }

  @Post()
  @RequirePermission("crm", "administer")
  create(@Body() dto: CreateOpportunityReasonDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateOpportunityReasonDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("crm", "administer")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }
}
