import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { TenantUsersService } from "./tenant-users.service";
import { CreateTenantUserDto } from "./dto/create-tenant-user.dto";
import { UpdateTenantUserDto } from "./dto/update-tenant-user.dto";
import { ChangeOwnPasswordDto } from "./dto/change-password.dto";
import { SetTwoFactorDto } from "./dto/set-two-factor.dto";

@Controller("tenant-users")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class TenantUsersController {
  constructor(private readonly service: TenantUsersService) {}

  /** Perfil do próprio usuário autenticado — sem checagem de permissão de "configuracoes": todo usuário pode ver seus próprios dados. */
  @Get("me")
  me(@CurrentUser() user: AuthenticatedRequestUser) {
    if (user.impersonation) {
      return this.service.getImpersonatedProfile(user.impersonation.masterUserId, user.roleId as string);
    }
    return this.service.get(user.id);
  }

  @Get()
  @RequirePermission("configuracoes", "view")
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission("configuracoes", "create")
  create(@Body() dto: CreateTenantUserDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.create(
      dto,
      { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") },
      user.tenantId as string,
    );
  }

  @Patch(":id")
  @RequirePermission("configuracoes", "edit")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateTenantUserDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }

  @Delete(":id")
  @RequirePermission("configuracoes", "delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.remove(id, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }

  /** Segurança > Senha (documento de alterações, item 8.1) — sem checagem de permissão de "configuracoes", todo usuário troca a própria senha. */
  @Post("me/password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changeOwnPassword(@Body() dto: ChangeOwnPasswordDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.changeOwnPassword(user.id, dto.senhaAtual, dto.novaSenha, {
      actorId: user.id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  }

  /** Segurança > Verificação em duas etapas (documento de alterações, item 8.2). */
  @Post("me/two-factor")
  @HttpCode(HttpStatus.OK)
  setTwoFactor(@Body() dto: SetTwoFactorDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.setTwoFactorEnabled(user.id, dto.enabled, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }
}
