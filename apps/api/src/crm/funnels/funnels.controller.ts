import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { FunnelsService } from "./funnels.service";
import { CreateFunnelDto } from "./dto/create-funnel.dto";
import { UpdateFunnelDto } from "./dto/update-funnel.dto";
import { CreateStageDto } from "./dto/create-stage.dto";
import { UpdateStageDto } from "./dto/update-stage.dto";

@Controller("crm/funnels")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class FunnelsController {
  constructor(private readonly service: FunnelsService) {}

  @Get()
  @RequirePermission("crm", "view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("crm", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("crm", "administer")
  create(@Body() dto: CreateFunnelDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateFunnelDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(":id/stages")
  @RequirePermission("crm", "administer")
  addStage(@Param("id") id: string, @Body() dto: CreateStageDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.addStage(id, dto, user.id);
  }

  @Patch(":id/stages/:stageId")
  @RequirePermission("crm", "administer")
  updateStage(
    @Param("id") id: string,
    @Param("stageId") stageId: string,
    @Body() dto: UpdateStageDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.updateStage(id, stageId, dto, user.id);
  }
}
