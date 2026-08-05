import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../common/modules/module-active.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequireModule } from "../common/modules/require-module.decorator";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { AutomationsService } from "./automations.service";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { UpdateAutomationDto } from "./dto/update-automation.dto";
import { TestAutomationDto } from "./dto/test-automation.dto";

@Controller("automation/rules")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("automacao")
export class AutomationsController {
  constructor(private readonly service: AutomationsService) {}

  @Get()
  @RequirePermission("automacao", "view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("automacao", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Get(":id/executions")
  @RequirePermission("automacao", "view")
  listExecutions(@Param("id") id: string) {
    return this.service.listExecutions(id);
  }

  @Post()
  @RequirePermission("automacao", "create")
  create(@Body() dto: CreateAutomationDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("automacao", "edit")
  update(@Param("id") id: string, @Body() dto: UpdateAutomationDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("automacao", "delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }

  @Post(":id/test")
  @RequirePermission("automacao", "edit")
  test(@Param("id") id: string, @Body() dto: TestAutomationDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.test(id, dto.contactId, dto.conversationId, user.id);
  }
}
