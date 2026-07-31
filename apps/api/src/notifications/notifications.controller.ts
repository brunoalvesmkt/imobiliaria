import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { NotificationsService } from "./notifications.service";

/**
 * Central de notificações — sem `RequirePermission`/`RequireModule`: são
 * pessoais do usuário autenticado (broadcast da empresa ou dirigidas a ele),
 * não um recurso de um módulo comercial específico.
 */
@Controller("notifications")
@UseGuards(TenantAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser, @Query("unreadOnly") unreadOnly?: string) {
    return this.service.list(user.id, unreadOnly === "true");
  }

  @Get("unread-count")
  async unreadCount(@CurrentUser() user: AuthenticatedRequestUser) {
    return { count: await this.service.unreadCount(user.id) };
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.markRead(id, user.id);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.markAllRead(user.id);
  }
}
