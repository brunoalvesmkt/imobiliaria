import { HttpException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { TokenService } from "./token.service";
import { generateOpaqueToken, hashOpaqueToken, verifyPassword } from "./crypto.util";
import { computeLockUntil, isCurrentlyLocked, minutesUntil } from "./account-lockout.util";
import type { LoginDto } from "./dto/login.dto";
import type { RequestMeta, TenantSession } from "./auth.service";

@Injectable()
export class MasterAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta): Promise<TenantSession> {
    const user = await this.prisma.masterUser.findUnique({ where: { email: dto.email } });

    if (!user || user.status !== "active") {
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
      await this.prisma.masterUser.update({
        where: { id: user.id },
        data: { failedLoginAttempts, lockedUntil: computeLockUntil(failedLoginAttempts) },
      });
      throw new UnauthorizedException("Credenciais inválidas.");
    }

    await this.prisma.masterUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.audit.record({
      actorId: user.id,
      actorType: "master",
      action: "auth.login",
      entity: "MasterUser",
      entityId: user.id,
      tenantId: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueSession(user.id);
  }

  /** Nome/e-mail para o avatar do painel Master — o JWT só carrega `sub`/`role`. */
  async getProfile(id: string): Promise<{ nome: string; email: string } | null> {
    const user = await this.prisma.masterUser.findUnique({ where: { id }, select: { nome: true, email: true } });
    return user;
  }

  async refresh(rawRefreshToken: string): Promise<TenantSession> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt < new Date() || !record.masterUserId) {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    const user = await this.prisma.masterUser.findUnique({ where: { id: record.masterUserId } });
    if (!user || user.status !== "active") {
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    }

    const session = await this.issueSession(user.id);
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
      actorType: "master",
      action: "auth.logout",
      entity: "MasterUser",
      entityId: actorId,
      tenantId: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  private async issueSession(masterUserId: string): Promise<TenantSession> {
    const user = await this.prisma.masterUser.findUniqueOrThrow({ where: { id: masterUserId } });
    const accessToken = this.tokenService.signMasterAccessToken({ sub: user.id, role: user.role });
    const rawRefresh = generateOpaqueToken();
    const refreshTtlMs = this.tokenService.getRefreshTokenTtlMs();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: hashOpaqueToken(rawRefresh),
        masterUserId: user.id,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      },
    });

    return { accessToken, refreshToken: rawRefresh, refreshTtlMs };
  }
}
