import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthenticatedRequestUser, TenantAccessTokenPayload } from "../jwt-payload.interface";
import { TENANT_ACCESS_COOKIE } from "../cookie.util";
import { cookieExtractor } from "./cookie-extractor";

@Injectable()
export class TenantJwtStrategy extends PassportStrategy(Strategy, "jwt-tenant") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor(TENANT_ACCESS_COOKIE),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: TenantAccessTokenPayload): AuthenticatedRequestUser {
    if (payload.type !== "tenant") {
      throw new UnauthorizedException("Token inválido para este contexto.");
    }
    return {
      type: "tenant",
      id: payload.sub,
      tenantId: payload.tenantId,
      roleId: payload.roleId,
      ...(payload.impersonation ? { impersonation: payload.impersonation } : {}),
      ...(payload.emailConfirmed === false ? { emailConfirmed: false } : {}),
    };
  }
}
