import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "./roles.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "./dto/permission-input.dto";

@Controller("roles")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly service: RolesService,
  ) {}

  /** Módulos/ações disponíveis para montar o formulário de permissões no frontend, sem hardcoded duplicado lá. */
  @Get("permission-options")
  @RequirePermission("configuracoes", "view")
  permissionOptions() {
    return { modules: PERMISSION_MODULES, actions: PERMISSION_ACTIONS };
  }

  @Get()
  @RequirePermission("configuracoes", "view")
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.prisma.role.findMany({
      where: { tenantId: user.tenantId as string },
      select: { id: true, nome: true, descricao: true, isSystem: true },
      orderBy: { nome: "asc" },
    });
  }

  @Get(":id")
  @RequirePermission("configuracoes", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("configuracoes", "administer")
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("configuracoes", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("configuracoes", "administer")
  remove(
    @Param("id") id: string,
    @Query("substitutaRoleId") substitutaRoleId: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.remove(id, substitutaRoleId, user.id);
  }
}
