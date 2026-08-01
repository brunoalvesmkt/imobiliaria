import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AffiliatesModule } from "../affiliates/affiliates.module";
import { QueuesModule } from "../queues/queues.module";
import { PlatformSettingsModule } from "../master/settings/platform-settings.module";
import { AuthController } from "./auth.controller";
import { MasterAuthController } from "./master-auth.controller";
import { AffiliateAuthController } from "./affiliate-auth.controller";
import { AuthService } from "./auth.service";
import { MasterAuthService } from "./master-auth.service";
import { AffiliateAuthService } from "./affiliate-auth.service";
import { TokenService } from "./token.service";
import { TenantJwtStrategy } from "./strategies/tenant-jwt.strategy";
import { MasterJwtStrategy } from "./strategies/master-jwt.strategy";
import { AffiliateJwtStrategy } from "./strategies/affiliate-jwt.strategy";

@Module({
  imports: [PassportModule, JwtModule.register({}), AffiliatesModule, QueuesModule, PlatformSettingsModule],
  controllers: [AuthController, MasterAuthController, AffiliateAuthController],
  providers: [
    AuthService,
    MasterAuthService,
    AffiliateAuthService,
    TokenService,
    TenantJwtStrategy,
    MasterJwtStrategy,
    AffiliateJwtStrategy,
  ],
  exports: [TokenService],
})
export class AuthModule {}
