import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { QuickMessagesService } from "./quick-messages.service";
import { CreateQuickMessageDto } from "./dto/create-quick-message.dto";
import { UpdateQuickMessageDto } from "./dto/update-quick-message.dto";

@Controller("atendimento/quick-messages")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("atendimento")
export class QuickMessagesController {
  constructor(private readonly service: QuickMessagesService) {}

  @Get()
  @RequirePermission("atendimento", "view")
  list(@Query("teamId") teamId?: string) {
    return this.service.list(teamId);
  }

  @Post()
  @RequirePermission("atendimento", "administer")
  create(@Body() dto: CreateQuickMessageDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("atendimento", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateQuickMessageDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(":id/render")
  @RequirePermission("atendimento", "send")
  render(
    @Param("id") id: string,
    @Body("conversationId") conversationId: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.render(id, conversationId, user.id);
  }
}
