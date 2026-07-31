import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthenticatedRequestUser, MasterAccessTokenPayload } from "../jwt-payload.interface";
import { MASTER_ACCESS_COOKIE } from "../cookie.util";
import { cookieExtractor } from "./cookie-extractor";

@Injectable()
export class MasterJwtStrategy extends PassportStrategy(Strategy, "jwt-master") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor(MASTER_ACCESS_COOKIE),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  validate(payload: MasterAccessTokenPayload): AuthenticatedRequestUser {
    if (payload.type !== "master") {
      throw new UnauthorizedException("Token inválido para este contexto.");
    }
    return {
      type: "master",
      id: payload.sub,
      masterRole: payload.role,
    };
  }
}
