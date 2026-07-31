import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { NotificationSettingsService } from "./notification-settings.service";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";

@Controller("notifications/settings/whatsapp")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class NotificationSettingsController {
  constructor(private readonly service: NotificationSettingsService) {}

  @Get()
  @RequirePermission("configuracoes", "view")
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission("configuracoes", "administer")
  update(@Body() dto: UpdateNotificationSettingsDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(dto, user.id);
  }
}
