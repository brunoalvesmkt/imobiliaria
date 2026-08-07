import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { NotificationTemplatesService } from "./notification-templates.service";
import { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";

@Controller("notifications/settings/templates")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class NotificationTemplatesController {
  constructor(private readonly service: NotificationTemplatesService) {}

  @Get()
  @RequirePermission("configuracoes", "view")
  list() {
    return this.service.list();
  }

  @Patch(":tipo")
  @RequirePermission("configuracoes", "administer")
  update(@Param("tipo") tipo: string, @Body() dto: UpdateNotificationTemplateDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(tipo, dto, user.id);
  }

  @Delete(":tipo")
  @RequirePermission("configuracoes", "administer")
  reset(@Param("tipo") tipo: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.reset(tipo, user.id);
  }
}
