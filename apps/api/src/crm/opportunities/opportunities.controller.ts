import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { createOpportunitySchema } from "@chatbot-saas/validation";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { OpportunitiesService } from "./opportunities.service";
import { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import { MoveStageDto } from "./dto/move-stage.dto";
import { CloseOpportunityDto } from "./dto/close-opportunity.dto";
import { ReorderDto } from "./dto/reorder.dto";
import { TransferResponsavelDto } from "./dto/transfer-responsavel.dto";

@Controller("crm/opportunities")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class OpportunitiesController {
  constructor(private readonly service: OpportunitiesService) {}

  @Get()
  @RequirePermission("crm", "view")
  list(@Query("funnelId") funnelId?: string, @Query("stageId") stageId?: string) {
    return this.service.list(funnelId, stageId);
  }

  // Precisa vir antes de "@Get(':id')" — senão o Nest tentaria casar "responsavel-options" como um :id.
  @Get("responsavel-options")
  @RequirePermission("crm", "view")
  listResponsavelOptions() {
    return this.service.listResponsavelOptions();
  }

  @Get(":id")
  @RequirePermission("crm", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("crm", "create")
  create(@Body(new ZodValidationPipe(createOpportunitySchema)) dto: CreateOpportunityDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "edit")
  update(@Param("id") id: string, @Body() dto: UpdateOpportunityDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Patch(":id/responsavel")
  @RequirePermission("crm", "transfer")
  transferResponsavel(@Param("id") id: string, @Body() dto: TransferResponsavelDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.transferResponsavel(id, dto, user.id);
  }

  @Patch(":id/stage")
  @RequirePermission("crm", "edit")
  moveStage(@Param("id") id: string, @Body() dto: MoveStageDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.moveStage(id, dto, user.id);
  }

  @Patch(":id/close")
  @RequirePermission("crm", "edit")
  close(@Param("id") id: string, @Body() dto: CloseOpportunityDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.close(id, dto, user.id);
  }

  @Post("reorder")
  @RequirePermission("crm", "edit")
  reorder(@Body() dto: ReorderDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.reorder(dto.stageId, dto.orderedIds, user.id);
  }
}
