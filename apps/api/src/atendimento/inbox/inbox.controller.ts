import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { InboxService } from "./inbox.service";
import { AssignQueueDto } from "./dto/assign-queue.dto";
import { TransferDto } from "./dto/transfer.dto";

@Controller("atendimento/inbox")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("atendimento")
export class InboxController {
  constructor(private readonly service: InboxService) {}

  @Get()
  @RequirePermission("atendimento", "view")
  list(
    @Query("status") status?: string,
    @Query("queueId") queueId?: string,
    @Query("responsavelId") responsavelId?: string,
  ) {
    return this.service.list(status, queueId, responsavelId);
  }

  @Patch(":id/queue")
  @RequirePermission("atendimento", "transfer")
  assignToQueue(
    @Param("id") id: string,
    @Body() dto: AssignQueueDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.assignToQueue(id, dto, user.id);
  }

  @Post(":id/auto-assign")
  @RequirePermission("atendimento", "transfer")
  autoAssign(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.autoAssign(id, user.id);
  }

  @Post(":id/assume")
  @RequirePermission("atendimento", "transfer")
  assume(
    @Param("id") id: string,
    @Query("force") force: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.assume(id, user.id, force === "true");
  }

  @Post(":id/return-to-queue")
  @RequirePermission("atendimento", "transfer")
  returnToQueue(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.returnToQueue(id, user.id);
  }

  @Post(":id/transfer")
  @RequirePermission("atendimento", "transfer")
  transfer(@Param("id") id: string, @Body() dto: TransferDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.transfer(id, dto, user.id);
  }

  @Post(":id/close")
  @RequirePermission("atendimento", "edit")
  close(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.close(id, user.id);
  }

  @Post(":id/reopen")
  @RequirePermission("atendimento", "edit")
  reopen(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.reopen(id, user.id);
  }
}
