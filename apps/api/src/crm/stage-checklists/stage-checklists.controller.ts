import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { StageChecklistsService } from "./stage-checklists.service";
import { CreateStageChecklistItemDto } from "./dto/create-stage-checklist-item.dto";
import { UpdateStageChecklistItemDto } from "./dto/update-stage-checklist-item.dto";
import { UpdateChecklistProgressDto } from "./dto/update-checklist-progress.dto";

@Controller("crm/stage-checklists")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class StageChecklistsController {
  constructor(private readonly service: StageChecklistsService) {}

  @Get()
  @RequirePermission("crm", "view")
  listItems(@Query("stageId") stageId: string) {
    return this.service.listItems(stageId);
  }

  @Post()
  @RequirePermission("crm", "administer")
  createItem(@Body() dto: CreateStageChecklistItemDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.createItem(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "administer")
  updateItem(@Param("id") id: string, @Body() dto: UpdateStageChecklistItemDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.updateItem(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("crm", "administer")
  deleteItem(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.deleteItem(id, user.id);
  }

  @Get("opportunity/:opportunityId/history")
  @RequirePermission("crm", "view")
  getHistory(@Param("opportunityId") opportunityId: string) {
    return this.service.getHistory(opportunityId);
  }

  @Get("opportunity/:opportunityId/progress")
  @RequirePermission("crm", "view")
  getProgress(@Param("opportunityId") opportunityId: string) {
    return this.service.getProgress(opportunityId);
  }

  @Patch("opportunity/:opportunityId/progress")
  @RequirePermission("crm", "edit")
  updateProgress(
    @Param("opportunityId") opportunityId: string,
    @Body() dto: UpdateChecklistProgressDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.updateProgress(opportunityId, dto, user.id);
  }
}
