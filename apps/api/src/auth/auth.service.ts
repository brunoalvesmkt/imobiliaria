import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { AffiliatesService } from "../affiliates/affiliates.service";
import { NotificationsProducer } from "../queues/notifications.producer";
import { PlatformSettingsService } from "../master/settings/platform-settings.service";
import { TokenService } from "./token.service";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, slugify, verifyPassword } from "./crypto.util";
import { computeLockUntil, isCurrentlyLocked, minutesUntil } from "./account-lockout.util";
import { ADMIN_DEFAULT_PERMISSIONS } from "./default-permissions";
import { createDefaultFunnel } from "../crm/funnels/default-funnel.util";
import type { SignupTenantDto } from "./dto/signup-tenant.dto";
import type { LoginDto } from "./dto/login.dto";

export interface RequestMeta {
  ip?: string | undefined;
  userAgent?: string | undefined;
}

export interface TenantSession {
  accessToken: string;
  refreshToken: string;
  refreshTtlMs: number;
}

export interface TwoFactorRequired {
  requiresTwoFactor: true;
  challengeToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly audit: AuditService,
    private readonly affiliates: AffiliatesService,
    private readonly notifications: NotificationsProducer,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async signupTenant(dto: SignupTenantDto, meta: RequestMeta): Promise<TenantSession> {
    const [existingCnpj, existingEmail, plan, segmento] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { cnpj: dto.cnpj } }),
      this.prisma.tenantUser.findUnique({ where: { email: dto.email } }),
      this.prisma.plan.findUnique({ where: { id: dto.planId } }),
      this.prisma.segment.findUnique({ where: { id: dto.segmentoId } }),
    ]);
    if (existingCnpj) {
      throw new ConflictException("CPF/CNPJ já cadastrado.");
    }
    if (existingEmail) {
      throw new ConflictException("E-mail já cadastrado.");
    }
    // Não confiar no `planId` só porque veio no corpo da requisição — o
    // documento de alterações exige revalidar o plano no backend antes de
    // criar a conta (item 2.4), inclusive impedindo um plano não-público
    // (interno/arquivado) de ser contratado manipulando a requisição.
    if (!plan || !plan.ativo || !plan.publicoAtivo) {
      throw new NotFoundException("Plano não encontrado ou não disponível para contratação.");
    }
    if (dto.periodicidade === "anual" && plan.precoAnual === null) {
      throw new BadRequestException("Este plano não tem modalidade anual.");
    }
    if (!segmento || !segmento.ativo) {
      throw new BadRequestException("Segmento inválido.");
    }

    const subdominio = await this.generateUniqueSubdomain(dto.razaoSocial);
    const passwordHash = await hashPassword(dto.senha);

    const platformSettings = await this.platformSettings.get();
    const precoContratado = dto.periodicidade === "anual" ? plan.precoAnual! : plan.preco;
    const now = new Date();
    const trialEndsAt = plan.diasTeste > 0 ? new Date(now.getTime() + plan.diasTeste * 24 * 60 * 60 * 1000) : null;

    const { tenant, tenantUser } = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          razaoSocial: dto.razaoSocial,
          cnpj: dto.cnpj,
          responsavel: dto.responsavel,
          endereco: dto.endereco,
          numero: dto.numero,
          bairro: dto.bairro,
          cidade: dto.cidade,
          uf: dto.uf,
          cep: dto.cep,
          segmentoId: dto.segmentoId,
          telefone: dto.telefone,
          whatsapp: dto.whatsapp,
          email: dto.email,
          emailConfirmado: !platformSettings.emailConfirmCodeEnabled,
          subdominio,
          planId: plan.id,
          status: "trial",
        },
      });

      await createDefaultFunnel(tx, tenant.id);

      // Fotografia das condições comerciais contratadas (documento de
      // alterações, item 2.6) — mudanças futuras no Plan não afetam esta
      // assinatura já criada.
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: "active",
          startedAt: now,
          recorrenciaContratada: dto.periodicidade,
          precoContratado,
          diasTesteContratado: plan.diasTeste,
          trialEndsAt,
        },
      });

      // Ativa só os módulos incluídos no plano contratado — nenhum módulo
      // vem ligado por padrão fora disso.
      const modulos = Array.isArray(plan.modulos) ? (plan.modulos as unknown[]).filter((m): m is string => typeof m === "string") : [];
      if (modulos.length > 0) {
        await tx.featureFlag.createMany({
          data: modulos.map((module) => ({ tenantId: tenant.id, module, enabled: true, enabledAt: now })),
        });
      }

      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          nome: "admin",
          descricao: "Acesso total aos módulos ativos e a Configurações",
          isSystem: true,
        },
      });

      await tx.permission.createMany({
        data: ADMIN_DEFAULT_PERMISSIONS.map((permission) => ({
          roleId: adminRole.id,
          module: permission.module,
          action: permission.action,
        })),
      });

      const tenantUser = await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          nome: dto.responsavel,
          email: dto.email,
          passwordHash,
          roleId: adminRole.id,
          status: "active",
        },
      });

      return { tenant, tenantUser };
    });

    await this.audit.record({
      actorId: tenantUser.id,
      actorType: "tenant_user",
      action: "tenant.signup",
      entity: "Tenant",
      entityId: tenant.id,
      tenantId: tenant.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    if (dto.affiliateLinkCode) {
      await this.affiliates.trackSignup(dto.affiliateLinkCode, tenant.id);
    }

    if (platformSettings.emailConfirmCodeEnabled) {
      await this.sendEmailConfirmationCode(tenant.id, tenantUser.id, tenant.email);
    }

    return this.issueTenantSession(tenantUser.id, tenant.id, tenantUser.roleId);
  }

  /**
   * Gera e envia o código de confirmação (documento de alterações, seção
   * 4) — usado tanto para confirmar o e-mail informado no cadastro (sem
   * `emailPendente`, já que o e-mail em si não muda) quanto, via
   * `TenantsService`, para confirmar a troca de e-mail em "Meus Dados"
   * (que reaproveita os mesmos campos com `emailPendente` preenchido).
   */
  private async sendEmailConfirmationCode(tenantId: string, tenantUserId: string, email: string): Promise<void> {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emailPendenteCodigo: hashOpaqueToken(codigo),
        emailPendenteExpira: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    await this.notifications.enqueueEmailConfirmationCode({ tenantId, tenantUserId, email, codigo });
  }

  async loginTenant(dto: LoginDto, meta: RequestMeta): Promise<TenantSession | TwoFactorRequired> {
    const user = await this.prisma.tenantUser.findUnique({ where: { email: dto.email } });

    if (!user || user.deletedAt || user.status !== "active") {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    if (isCurrentlyLocked(user.lockedUntil)) {
      throw new HttpException(
        `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutesUntil(user.lockedUntil as Date)} minuto(s).`,
        423, // Locked — não existe em HttpStatus desta versão do NestJS
      );
    }

    const passwordValid = await verifyPassword(user.passwordHash, dto.senha);
    if (!passwordValid) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      await this.prisma.tenantUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts, lockedUntil: computeLockUntil(failedLoginAttempts) },
      });
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    await this.prisma.tenantUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.audit.record({
      actorId: user.id,
      actorType: "tenant_user",
      action: "auth.login",
      entity: "TenantUser",
      entityId: user.id,
      tenantId: user.tenantId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    if (user.twoFactorEnabled) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const challengeToken = this.tokenService.signTwoFactorChallenge({ sub: user.id, codeHash: hashOpaqueToken(codigo) });
      await this.notifications.enqueueTwoFactorLoginCode({ tenantId: user.tenantId, tenantUserId: user.id, email: user.email, codigo });
      return { requiresTwoFactor: true, challengeToken };
    }

    return this.issueTenantSession(user.id, user.tenantId, user.roleId);
  }

  async verifyTwoFactorLogin(challengeToken: string, codigo: string): Promise<TenantSession> {
    let payload: { sub: string; codeHash: string };
    try {
      payload = this.tokenService.verifyTwoFactorChallenge(challengeToken);
    } catch {
      throw new UnauthorizedException("Código expirado — faça login novamente.");
    }

    if (payload.codeHash !== hashOpaqueToken(codigo)) {
      throw new UnauthorizedException("Código inválido.");
    }

    const user = await this.prisma.tenantUser.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt || user.status !== "active") {
      throw new UnauthorizedException("Sessão inválida.");
    }

    return this.issueTenantSession(user.id, user.tenantId, user.roleId);
  }

  async refreshTenantSession(rawRefreshToken: string): Promise<TenantSession> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date() || !record.tenantUserId || !record.tenantId) {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    const user = await this.prisma.tenantUser.findUnique({ where: { id: record.tenantUserId } });
    if (!user || user.deletedAt || user.status !== "active") {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    const session = await this.issueTenantSession(user.id, user.tenantId, user.roleId);
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    return session;
  }

  async logoutTenant(rawRefreshToken: string, actorId: string, tenantId: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "auth.logout",
      entity: "TenantUser",
      entityId: actorId,
      tenantId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Encerra o registro de sessão de impersonação ativa (Fase 29, ver
   * DEVELOPMENT_PLAN.md) — chamado no logout de um token de acesso
   * assistido, que nunca tem refresh token e por isso não passa por
   * `logoutTenant`.
   */
  async endImpersonationSession(tenantId: string, masterUserId: string): Promise<void> {
    await this.prisma.impersonationSession.updateMany({
      where: { tenantId, masterUserId, endedAt: null },
      data: { endedAt: new Date() },
    });
  }

  /**
   * Resposta sempre neutra ao chamador (ver SECURITY.md §1) — nunca revela
   * se o e-mail existe. O trabalho real (gerar token) só acontece quando o
   * usuário existe e está ativo.
   */
  async requestTenantPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.tenantUser.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.status !== "active") {
      return;
    }

    const rawToken = generateOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: hashOpaqueToken(rawToken),
        tenantUserId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    await this.notifications.enqueuePasswordResetEmail({
      tenantId: user.tenantId,
      tenantUserId: user.id,
      email: user.email,
      rawToken,
    });
  }

  async confirmTenantPasswordReset(rawToken: string, novaSenha: string): Promise<void> {
    const tokenHash = hashOpaqueToken(rawToken);
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date() || !record.tenantUserId) {
      throw new BadRequestException("Token inválido ou expirado.");
    }

    const user = await this.prisma.tenantUser.findUniqueOrThrow({ where: { id: record.tenantUserId } });
    const passwordHash = await hashPassword(novaSenha);

    await this.prisma.$transaction([
      this.prisma.tenantUser.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { tenantUserId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      actorId: user.id,
      actorType: "tenant_user",
      action: "auth.password_reset",
      entity: "TenantUser",
      entityId: user.id,
      tenantId: user.tenantId,
    });
  }

  private async issueTenantSession(tenantUserId: string, tenantId: string, roleId: string): Promise<TenantSession> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { emailConfirmado: true } });
    const accessToken = this.tokenService.signTenantAccessToken({
      sub: tenantUserId,
      tenantId,
      roleId,
      ...(tenant.emailConfirmado ? {} : { emailConfirmed: false }),
    });
    const rawRefresh = generateOpaqueToken();
    const refreshTtlMs = this.tokenService.getRefreshTokenTtlMs();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashOpaqueToken(rawRefresh),
        tenantId,
        tenantUserId,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return { accessToken, refreshToken: rawRefresh, refreshTtlMs };
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
}
