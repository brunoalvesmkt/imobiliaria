import { Controller, Get, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";

@Controller("tenants/me")
@UseGuards(TenantAuthGuard)
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId as string },
      select: { id: true, razaoSocial: true, subdominio: true, status: true, createdAt: true },
    });
  }

  /**
   * Lista os módulos comerciais ativos para o tenant autenticado. Ainda sem
   * módulos comerciais reais por trás (entram a partir da Fase 3) — a
   * infraestrutura de FeatureFlag já fica pronta e testável nesta fase (ver
   * DEVELOPMENT_PLAN.md, item 1.8).
   */
  @Get("features")
  async features(@CurrentUser() _user: AuthenticatedRequestUser) {
    const flags = await this.tenantPrisma.featureFlag.findMany({});
    return flags.map((flag) => ({ module: flag.module, enabled: flag.enabled }));
  }
}
