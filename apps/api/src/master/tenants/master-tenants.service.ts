import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { MasterRole, Prisma, TenantStatus } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { TokenService } from "../../auth/token.service";
import { toCsv } from "../../reports/csv.util";
import type { MasterActorContext } from "../plans/plans.service";
import type { UpdateTenantStatusDto } from "./dto/update-tenant-status.dto";
import type { AssignPlanDto } from "./dto/assign-plan.dto";
import type { ToggleModuleDto } from "./dto/toggle-module.dto";
import type { ImpersonateDto } from "./dto/impersonate.dto";

@Injectable()
export class MasterTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokenService: TokenService,
  ) {}

  async list(status?: TenantStatus) {
    const tenants = await this.prisma.tenant.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { id: true, nome: true } } },
    });

    const activeSessions = await this.prisma.impersonationSession.findMany({
      where: { tenantId: { in: tenants.map((t) => t.id) }, endedAt: null, expiresAt: { gt: new Date() } },
      select: { tenantId: true },
    });
    const activeTenantIds = new Set(activeSessions.map((s) => s.tenantId));

    return tenants.map((tenant) => ({ ...tenant, impersonationActive: activeTenantIds.has(tenant.id) }));
  }

  async get(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        plan: true,
        featureFlags: true,
        subscriptions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!tenant) {
      throw new NotFoundException("Empresa não encontrada.");
    }
    return tenant;
  }

  async consumption(id: string) {
    await this.get(id);
    const [tenantUsers, files] = await Promise.all([
      this.prisma.tenantUser.count({ where: { tenantId: id, deletedAt: null } }),
      this.prisma.file.count({ where: { tenantId: id, deletedAt: null } }),
    ]);
    return { tenantUsers, files };
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto, actor: MasterActorContext) {
    const before = await this.get(id);

    const updated = await this.prisma.tenant.update({ where: { id }, data: { status: dto.status } });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: id,
      action: "tenant.status_change",
      entity: "Tenant",
      entityId: id,
      previousData: { status: before.status },
      newData: { status: updated.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async assignPlan(id: string, dto: AssignPlanDto, actor: MasterActorContext) {
    const [tenant, plan] = await Promise.all([
      this.get(id),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
    ]);
    if (!plan) {
      throw new NotFoundException("Plano não encontrado.");
    }

    await this.prisma.subscription.updateMany({
      where: { tenantId: id, status: { in: ["waiting", "active", "overdue"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });

    const [updatedTenant, subscription] = await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id }, data: { planId: plan.id } }),
      this.prisma.subscription.create({
        data: { tenantId: id, planId: plan.id, status: "active", startedAt: new Date() },
      }),
    ]);

    // Concessão direta pelo Master (sem passar pelo fluxo de cobrança de
    // BillingService) — gera uma fatura já paga/manual só para manter o
    // histórico financeiro consistente (ver DEVELOPMENT_PLAN.md Fase 8).
    await this.prisma.invoice.create({
      data: {
        tenantId: id,
        subscriptionId: subscription.id,
        valor: plan.preco,
        status: "paid",
        metodo: "manual",
        vencimento: new Date(),
        pagoEm: new Date(),
      },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: id,
      action: "tenant.plan_change",
      entity: "Tenant",
      entityId: id,
      previousData: { planId: tenant.planId },
      newData: { planId: plan.id, planNome: plan.nome },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updatedTenant;
  }

  async toggleModule(id: string, dto: ToggleModuleDto, actor: MasterActorContext) {
    await this.get(id);

    const flag = await this.prisma.featureFlag.upsert({
      where: { tenantId_module: { tenantId: id, module: dto.module } },
      create: {
        tenantId: id,
        module: dto.module,
        enabled: dto.enabled,
        enabledAt: dto.enabled ? new Date() : null,
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
      },
      update: {
        enabled: dto.enabled,
        ...(dto.enabled ? { enabledAt: new Date(), disabledAt: null } : { disabledAt: new Date() }),
        ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
      },
    });

    // Regras de ativação/desativação de módulo (preservar dados, nunca
    // apagar) — ver MODULE_DEPENDENCIES.md §2-3.
    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: id,
      action: dto.enabled ? "module.enabled" : "module.disabled",
      entity: "FeatureFlag",
      entityId: flag.id,
      newData: { module: dto.module, enabled: dto.enabled },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return flag;
  }

  /**
   * Acesso assistido (impersonação) — ver PERMISSIONS_MATRIX.md §7. Regras
   * de nível por papel Master:
   * - super_admin: qualquer nível (leitura ou leitura+escrita).
   * - suporte: sempre forçado para somente leitura, mesmo se solicitar read_write.
   * - financeiro: sem acesso a impersonação.
   *
   * Emite um access token de tenant de curta duração (mesmo TTL do login
   * normal) sem refresh token — a sessão de impersonação expira sozinha e
   * não pode ser renovada silenciosamente.
   */
  async impersonate(
    id: string,
    dto: ImpersonateDto,
    masterUser: { id: string; role: MasterRole },
    actor: MasterActorContext,
  ) {
    if (masterUser.role === "financeiro") {
      throw new ForbiddenException("Este papel não tem acesso a acesso assistido.");
    }

    const accessLevel = masterUser.role === "suporte" ? "read" : dto.accessLevel;

    const tenant = await this.get(id);
    const adminRole = await this.prisma.role.findFirst({
      where: { tenantId: tenant.id, isSystem: true, nome: "admin" },
    });
    if (!adminRole) {
      throw new NotFoundException("Papel admin do tenant não encontrado — não é possível impersonar.");
    }

    const accessToken = this.tokenService.signTenantAccessToken({
      sub: masterUser.id,
      tenantId: tenant.id,
      roleId: adminRole.id,
      impersonation: { masterUserId: masterUser.id, accessLevel },
    });

    // Mesmo TTL do access token de impersonação (15 min, sem refresh) — só
    // para o painel Master saber, sem heurística, quais empresas estão sob
    // acesso assistido agora (Fase 29, ver DEVELOPMENT_PLAN.md).
    await this.prisma.impersonationSession.create({
      data: {
        tenantId: tenant.id,
        masterUserId: masterUser.id,
        accessLevel,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await this.audit.record({
      actorId: masterUser.id,
      actorType: "master",
      tenantId: tenant.id,
      onBehalfOfTenantId: tenant.id,
      action: "master.impersonation.start",
      entity: "Tenant",
      entityId: tenant.id,
      newData: { accessLevel },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return { accessToken, tenantId: tenant.id, accessLevel };
  }

  /** Encerra a sessão de impersonação ativa (chamado no logout do token de acesso assistido). */
  async endImpersonationSession(tenantId: string, masterUserId: string) {
    await this.prisma.impersonationSession.updateMany({
      where: { tenantId, masterUserId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  async exportCsv(): Promise<string> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { nome: true } } },
    });
    return toCsv(
      ["ID", "Razão Social", "CNPJ", "Status", "Plano", "Subdomínio", "Criado em"],
      tenants.map((t) => [
        t.id,
        t.razaoSocial,
        t.cnpj,
        t.status,
        t.plan?.nome ?? "",
        t.subdominio,
        t.createdAt.toISOString(),
      ]),
    );
  }
}
