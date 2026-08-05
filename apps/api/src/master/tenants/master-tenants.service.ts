import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { MasterRole, Prisma, TenantStatus } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { TokenService } from "../../auth/token.service";
import { AuthService } from "../../auth/auth.service";
import { hashPassword, slugify } from "../../auth/crypto.util";
import { toCsv } from "../../reports/csv.util";
import { ADMIN_DEFAULT_PERMISSIONS } from "../../auth/default-permissions";
import { createDefaultFunnel } from "../../crm/funnels/default-funnel.util";
import type { MasterActorContext } from "../plans/plans.service";
import type { UpdateTenantStatusDto } from "./dto/update-tenant-status.dto";
import type { AssignPlanDto } from "./dto/assign-plan.dto";
import type { ToggleModuleDto } from "./dto/toggle-module.dto";
import type { ImpersonateDto } from "./dto/impersonate.dto";
import type { CreateManualTenantDto } from "./dto/create-manual-tenant.dto";
import type { UpdateLoginEmailDto } from "./dto/update-login-email.dto";

@Injectable()
export class MasterTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Usuário de login "principal" da empresa — o mesmo papel `admin` do
   * sistema (ver `createManual`/`impersonate`), primeiro criado (na assinatura
   * pública ou no cadastro manual do Master). Empresas hoje só têm um usuário
   * admin nessa fase; se um dia houver mais de um, este é o alvo determinístico
   * das ações "e-mail de acesso"/"redefinição de senha" do Master.
   */
  private async getLoginUser(tenantId: string) {
    const adminRole = await this.prisma.role.findFirst({
      where: { tenantId, isSystem: true, nome: "admin" },
    });
    if (!adminRole) return null;

    return this.prisma.tenantUser.findFirst({
      where: { roleId: adminRole.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, nome: true, email: true },
    });
  }

  async getLoginAccess(id: string) {
    await this.get(id);
    const user = await this.getLoginUser(id);
    return { id: user?.id ?? null, nome: user?.nome ?? null, email: user?.email ?? null };
  }

  async updateLoginEmail(id: string, dto: UpdateLoginEmailDto, actor: MasterActorContext) {
    await this.get(id);
    const user = await this.getLoginUser(id);
    if (!user) {
      throw new NotFoundException("Usuário de acesso da empresa não encontrado.");
    }

    const existing = await this.prisma.tenantUser.findUnique({ where: { email: dto.email } });
    if (existing && existing.id !== user.id) {
      throw new ConflictException("Já existe um usuário cadastrado com esse e-mail.");
    }

    const updated = await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: { email: dto.email },
      select: { id: true, nome: true, email: true },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: id,
      action: "master.tenant_user.email_change",
      entity: "TenantUser",
      entityId: user.id,
      previousData: { email: user.email },
      newData: { email: updated.email },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return updated;
  }

  async resendPasswordReset(id: string, actor: MasterActorContext) {
    await this.get(id);
    const user = await this.getLoginUser(id);
    if (!user) {
      throw new NotFoundException("Usuário de acesso da empresa não encontrado.");
    }

    await this.authService.requestTenantPasswordReset(user.email);

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: id,
      action: "master.tenant_user.password_reset_requested",
      entity: "TenantUser",
      entityId: user.id,
      newData: { email: user.email },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return { sent: true };
  }

  async list(status?: TenantStatus) {
    const tenants = await this.prisma.tenant.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { id: true, nome: true } } },
    });

    const [activeSessions, overdueGroups] = await Promise.all([
      this.prisma.impersonationSession.findMany({
        where: { tenantId: { in: tenants.map((t) => t.id) }, endedAt: null, expiresAt: { gt: new Date() } },
        select: { tenantId: true },
      }),
      this.prisma.invoice.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenants.map((t) => t.id) }, status: "overdue" },
        _count: true,
      }),
    ]);
    const activeTenantIds = new Set(activeSessions.map((s) => s.tenantId));
    const overdueTenantIds = new Set(overdueGroups.map((g) => g.tenantId));

    return tenants.map((tenant) => ({
      ...tenant,
      impersonationActive: activeTenantIds.has(tenant.id),
      hasOverdueInvoices: overdueTenantIds.has(tenant.id),
    }));
  }

  private async generateUniqueSubdomain(razaoSocial: string): Promise<string> {
    const base = slugify(razaoSocial) || "empresa";
    let candidate = base;
    let attempt = 0;
    while (await this.prisma.tenant.findUnique({ where: { subdominio: candidate } })) {
      attempt += 1;
      candidate = `${base}-${attempt}`;
    }
    return candidate;
  }

  /**
   * Cadastro manual de empresa pelo Master (documento de alterações, item
   * 18.1) — mesma estrutura mínima do signup público (tenant + papel admin
   * + primeiro usuário), mas com e-mail já confirmado (o Master valida a
   * empresa por fora do fluxo) e, opcionalmente, plano/assinatura já
   * atribuídos direto (mesma lógica de fatura manual paga do `assignPlan`).
   */
  async createManual(dto: CreateManualTenantDto, actor: MasterActorContext) {
    const [existingCnpj, existingEmail] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj } }),
      this.prisma.tenantUser.findUnique({ where: { email: dto.email } }),
    ]);
    if (existingCnpj) {
      throw new ConflictException("Já existe uma empresa cadastrada com esse CNPJ/CPF.");
    }
    if (existingEmail) {
      throw new ConflictException("Já existe um usuário cadastrado com esse e-mail.");
    }

    const plan = dto.planId ? await this.prisma.plan.findUnique({ where: { id: dto.planId } }) : null;
    if (dto.planId && !plan) {
      throw new NotFoundException("Plano não encontrado.");
    }

    const subdominio = await this.generateUniqueSubdomain(dto.razaoSocial);
    const passwordHash = await hashPassword(dto.senha);

    const { tenant } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          razaoSocial: dto.razaoSocial,
          cnpj: dto.cnpj,
          responsavel: dto.responsavel,
          email: dto.email,
          emailConfirmado: true,
          subdominio,
          status: "active",
          ...(plan ? { planId: plan.id } : {}),
        },
      });

      await createDefaultFunnel(tx, tenant.id);

      const adminRole = await tx.role.create({
        data: { tenantId: tenant.id, nome: "admin", descricao: "Acesso total aos módulos ativos e a Configurações", isSystem: true },
      });
      await tx.permission.createMany({
        data: ADMIN_DEFAULT_PERMISSIONS.map((p) => ({ roleId: adminRole.id, module: p.module, action: p.action })),
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          nome: dto.responsavel,
          email: dto.email,
          passwordHash,
          roleId: adminRole.id,
          status: "active",
          invitedBy: actor.actorId,
          invitedAt: new Date(),
        },
      });

      if (plan) {
        const modulos = Array.isArray(plan.modulos) ? (plan.modulos as unknown[]).filter((m): m is string => typeof m === "string") : [];
        if (modulos.length > 0) {
          await tx.featureFlag.createMany({
            data: modulos.map((module) => ({ tenantId: tenant.id, module, enabled: true, enabledAt: new Date() })),
          });
        }

        const subscription = await tx.subscription.create({
          data: { tenantId: tenant.id, planId: plan.id, status: "active", startedAt: new Date() },
        });
        await tx.invoice.create({
          data: {
            tenantId: tenant.id,
            subscriptionId: subscription.id,
            valor: plan.preco,
            status: "paid",
            metodo: "manual",
            vencimento: new Date(),
            pagoEm: new Date(),
          },
        });
      }

      return { tenant };
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: tenant.id,
      action: "tenant.create_manual",
      entity: "Tenant",
      entityId: tenant.id,
      newData: { razaoSocial: tenant.razaoSocial, planId: plan?.id ?? null },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return this.get(tenant.id);
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
