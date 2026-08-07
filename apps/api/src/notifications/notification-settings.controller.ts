import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { NotificationSettingsService } from "./notification-settings.service";
import { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";
import { CreateNotificationRecipientDto } from "./dto/create-notification-recipient.dto";
import { UpdateNotificationRecipientDto } from "./dto/update-notification-recipient.dto";
import { CRITICAL_NOTIFICATION_TYPES } from "./notification-types";

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

  /** Tipos elegíveis para o filtro de um destinatário — só os hoje críticos por padrão; a criticidade real de cada um pode ter sido alterada em Configurações > Notificações > Tipos, mas a lista de opções aqui continua a mesma (ver notification-types.ts). */
  @Get("types")
  @RequirePermission("configuracoes", "view")
  listTypes() {
    return CRITICAL_NOTIFICATION_TYPES.map((t) => ({ tipo: t.tipo, label: t.defaultTitulo }));
  }

  @Get("recipients")
  @RequirePermission("configuracoes", "view")
  listRecipients() {
    return this.service.listRecipients();
  }

  @Post("recipients")
  @RequirePermission("configuracoes", "administer")
  createRecipient(@Body() dto: CreateNotificationRecipientDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.createRecipient(dto, user.id);
  }

  @Patch("recipients/:id")
  @RequirePermission("configuracoes", "administer")
  updateRecipient(@Param("id") id: string, @Body() dto: UpdateNotificationRecipientDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.updateRecipient(id, dto, user.id);
  }

  @Delete("recipients/:id")
  @RequirePermission("configuracoes", "administer")
  removeRecipient(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.removeRecipient(id, user.id);
  }

  @Get("recipients/:id/deliveries")
  @RequirePermission("configuracoes", "view")
  listDeliveries(@Param("id") id: string) {
    return this.service.listDeliveries(id);
  }
}
