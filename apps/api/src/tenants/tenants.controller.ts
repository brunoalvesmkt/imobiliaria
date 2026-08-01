import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { TenantsService } from "./tenants.service";
import { ConfirmEmailChangeDto, RequestEmailChangeDto } from "./dto/email-confirmation.dto";

@Controller("tenants/me")
@UseGuards(TenantAuthGuard)
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: user.tenantId as string },
      select: { id: true, razaoSocial: true, subdominio: true, status: true, createdAt: true, email: true, emailConfirmado: true },
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

  @Post("email/request-change")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermission("configuracoes", "administer")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestEmailChange(@CurrentUser() user: AuthenticatedRequestUser, @Body() dto: RequestEmailChangeDto) {
    return this.tenantsService.requestEmailChange(user.tenantId as string, user.id, dto.novoEmail);
  }

  @Post("email/confirm")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermission("configuracoes", "administer")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  confirmEmailChange(@CurrentUser() user: AuthenticatedRequestUser, @Body() dto: ConfirmEmailChangeDto) {
    return this.tenantsService.confirmEmailChange(user.tenantId as string, user.id, dto.codigo);
  }

  /**
   * Reenvia o código pendente — cobre tanto o reenvio da confirmação
   * inicial do cadastro (documento, item 4.2 "Reenviar código") quanto o
   * de uma troca de e-mail em andamento.
   */
  @Post("email/resend-code")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @RequirePermission("configuracoes", "administer")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  resendCode(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.tenantsService.resendCode(user.tenantId as string, user.id);
  }
}
