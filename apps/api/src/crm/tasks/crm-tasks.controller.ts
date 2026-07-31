import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { createCrmTaskSchema } from "@chatbot-saas/validation";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { CrmTasksService } from "./crm-tasks.service";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";

@Controller("crm/tasks")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class CrmTasksController {
  constructor(private readonly service: CrmTasksService) {}

  @Get()
  @RequirePermission("crm", "view")
  list(@Query("contactId") contactId?: string, @Query("status") status?: string) {
    return this.service.list(contactId, status);
  }

  @Get(":id")
  @RequirePermission("crm", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("crm", "create")
  create(@Body(new ZodValidationPipe(createCrmTaskSchema)) dto: CreateTaskDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "edit")
  update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }
}
