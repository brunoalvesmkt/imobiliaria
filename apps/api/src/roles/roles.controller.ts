import { Controller, Get, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";

@Controller("roles")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("configuracoes", "view")
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.prisma.role.findMany({
      where: { tenantId: user.tenantId as string },
      select: { id: true, nome: true, descricao: true, isSystem: true },
      orderBy: { nome: "asc" },
    });
  }
}
