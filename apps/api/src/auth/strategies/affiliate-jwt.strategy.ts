import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AffiliateAccessTokenPayload, AuthenticatedRequestUser } from "../jwt-payload.interface";
import { AFFILIATE_ACCESS_COOKIE } from "../cookie.util";
import { cookieExtractor } from "./cookie-extractor";

@Injectable()
export class AffiliateJwtStrategy extends PassportStrategy(Strategy, "jwt-affiliate") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor(AFFILIATE_ACCESS_COOKIE),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: AffiliateAccessTokenPayload): AuthenticatedRequestUser {
    if (payload.type !== "affiliate") {
      throw new UnauthorizedException("Token inválido para este contexto.");
    }
    return {
      type: "affiliate",
      id: payload.sub,
    };
  }
}
