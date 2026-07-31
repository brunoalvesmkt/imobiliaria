import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { TokenService } from "./token.service";
import { generateOpaqueToken, hashOpaqueToken, verifyPassword } from "./crypto.util";
import type { LoginDto } from "./dto/login.dto";
import type { RequestMeta, TenantSession } from "./auth.service";

export interface AffiliatePublicProfile {
  id: string;
  nome: string;
  sobrenome: string;
  email: string;
  status: string;
  linkCode: string;
}

/**
 * Login de autoatendimento do afiliado (Fase 32, ver DEVELOPMENT_PLAN.md) —
 * mesmo padrão de `MasterAuthService`/`AuthService`, mais simples por não
 * ter bloqueio progressivo (`Affiliate` não tem os campos de tentativa
 * falha/lockedUntil que `MasterUser`/`TenantUser` têm — débito consciente,
 * ver seção da fase).
 */
@Injectable()
export class AffiliateAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<TenantSession> {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { email: dto.email } });

    if (!affiliate || !affiliate.passwordHash) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    const passwordValid = await verifyPassword(affiliate.passwordHash, dto.senha);
    if (!passwordValid) {
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    await this.audit.record({
      actorId: affiliate.id,
      actorType: "affiliate",
      action: "auth.login",
      entity: "Affiliate",
      entityId: affiliate.id,
      tenantId: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueSession(affiliate.id);
  }

  async refresh(rawRefreshToken: string): Promise<TenantSession> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date() || !record.affiliateId) {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    const affiliate = await this.prisma.affiliate.findUnique({ where: { id: record.affiliateId } });
    if (!affiliate || !affiliate.passwordHash) {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    const session = await this.issueSession(affiliate.id);
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

    return session;
  }

  async logout(rawRefreshToken: string, actorId: string, meta: RequestMeta): Promise<void> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.record({
      actorId,
      actorType: "affiliate",
      action: "auth.logout",
      entity: "Affiliate",
      entityId: actorId,
      tenantId: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async getProfile(affiliateId: string): Promise<AffiliatePublicProfile> {
    const affiliate = await this.prisma.affiliate.findUnique({ where: { id: affiliateId } });
    if (!affiliate) {
      throw new NotFoundException("Afiliado não encontrado.");
    }
    return {
      id: affiliate.id,
      nome: affiliate.nome,
      sobrenome: affiliate.sobrenome,
      email: affiliate.email,
      status: affiliate.status,
      linkCode: affiliate.linkCode,
    };
  }

  private async issueSession(affiliateId: string): Promise<TenantSession> {
    const accessToken = this.tokenService.signAffiliateAccessToken({ sub: affiliateId });
    const rawRefresh = generateOpaqueToken();
    const refreshTtlMs = this.tokenService.getRefreshTokenTtlMs();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashOpaqueToken(rawRefresh),
        affiliateId,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return { accessToken, refreshToken: rawRefresh, refreshTtlMs };
  }
}
