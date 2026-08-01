import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { TaskTypesService } from "./task-types.service";
import { CreateTaskTypeDto } from "./dto/create-task-type.dto";
import { UpdateTaskTypeDto } from "./dto/update-task-type.dto";

@Controller("crm/task-types")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class TaskTypesController {
  constructor(private readonly service: TaskTypesService) {}

  @Get()
  @RequirePermission("crm", "view")
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission("crm", "administer")
  create(@Body() dto: CreateTaskTypeDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateTaskTypeDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("crm", "administer")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }
}
