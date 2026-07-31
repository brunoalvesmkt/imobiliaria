import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { QueuesService } from "./queues.service";
import { CreateQueueDto } from "./dto/create-queue.dto";
import { UpdateQueueDto } from "./dto/update-queue.dto";
import { CreateBusinessHoursDto } from "./dto/create-business-hours.dto";

@Controller("atendimento/queues")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("atendimento")
export class QueuesController {
  constructor(private readonly service: QueuesService) {}

  @Get()
  @RequirePermission("atendimento", "view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("atendimento", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("atendimento", "administer")
  create(@Body() dto: CreateQueueDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("atendimento", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateQueueDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Get(":id/business-hours")
  @RequirePermission("atendimento", "view")
  listBusinessHours(@Param("id") id: string) {
    return this.service.listBusinessHours(id);
  }

  @Post(":id/business-hours")
  @RequirePermission("atendimento", "administer")
  addBusinessHours(
    @Param("id") id: string,
    @Body() dto: CreateBusinessHoursDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.addBusinessHours(id, dto, user.id);
  }

  @Get(":id/is-open")
  @RequirePermission("atendimento", "view")
  isOpen(@Param("id") id: string) {
    return this.service.isOpen(id).then((open) => ({ open }));
  }
}
