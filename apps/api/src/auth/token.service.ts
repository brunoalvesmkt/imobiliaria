import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type {
  AccessTokenPayload,
  AffiliateAccessTokenPayload,
  MasterAccessTokenPayload,
  TenantAccessTokenPayload,
} from "./jwt-payload.interface";

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  signTenantAccessToken(payload: Omit<TenantAccessTokenPayload, "type">): string {
    return this.jwtService.sign(
      { ...payload, type: "tenant" } satisfies TenantAccessTokenPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m",
      },
    );
  }

  signMasterAccessToken(payload: Omit<MasterAccessTokenPayload, "type">): string {
    return this.jwtService.sign(
      { ...payload, type: "master" } satisfies MasterAccessTokenPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m",
      },
    );
  }

  signAffiliateAccessToken(payload: Omit<AffiliateAccessTokenPayload, "type">): string {
    return this.jwtService.sign(
      { ...payload, type: "affiliate" } satisfies AffiliateAccessTokenPayload,
      {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN") ?? "15m",
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  /**
   * Token de curta duração (10min) carregando só o hash do código de 2FA
   * (documento de alterações, item 8.2) — assinado, então o próprio token
   * já garante que o hash não foi adulterado, sem precisar de uma tabela
   * dedicada só para esse estado transitório de login.
   */
  signTwoFactorChallenge(payload: { sub: string; codeHash: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: "10m",
    });
  }

  verifyTwoFactorChallenge(token: string): { sub: string; codeHash: string } {
    return this.jwtService.verify<{ sub: string; codeHash: string }>(token, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  getRefreshTokenTtlMs(): number {
    const raw = this.config.get<string>("JWT_REFRESH_EXPIRES_IN") ?? "7d";
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    const [, amountRaw, unit] = match;
    const amount = Number(amountRaw);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
    return amount * unitMs;
  }
}
