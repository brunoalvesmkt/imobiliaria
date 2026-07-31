import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { loginSchema, signupTenantSchema } from "@chatbot-saas/validation";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { AuthService, type RequestMeta } from "./auth.service";
import { SignupTenantDto } from "./dto/signup-tenant.dto";
import { LoginDto } from "./dto/login.dto";
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from "./dto/password-reset.dto";
import { TENANT_ACCESS_COOKIE, TENANT_REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "./cookie.util";
import { TenantAuthGuard } from "./guards/tenant-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthenticatedRequestUser } from "./jwt-payload.interface";

function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.get("user-agent") };
}

@Controller("auth/tenant")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async signup(
    @Body(new ZodValidationPipe(signupTenantSchema)) dto: SignupTenantDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: "ok" }> {
    const session = await this.authService.signupTenant(dto, requestMeta(req));
    setAuthCookies(res, TENANT_ACCESS_COOKIE, session.accessToken, TENANT_REFRESH_COOKIE, session.refreshToken, session.refreshTtlMs);
    return { status: "ok" };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: "ok" }> {
    const session = await this.authService.loginTenant(dto, requestMeta(req));
    setAuthCookies(res, TENANT_ACCESS_COOKIE, session.accessToken, TENANT_REFRESH_COOKIE, session.refreshToken, session.refreshTtlMs);
    return { status: "ok" };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ status: "ok" }> {
    const rawRefreshToken = (req.cookies as Record<string, string> | undefined)?.[TENANT_REFRESH_COOKIE];
    if (!rawRefreshToken) {
      throw new UnauthorizedException("Refresh token ausente.");
    }
    const session = await this.authService.refreshTenantSession(rawRefreshToken);
    setAuthCookies(res, TENANT_ACCESS_COOKIE, session.accessToken, TENANT_REFRESH_COOKIE, session.refreshToken, session.refreshTtlMs);
    return { status: "ok" };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(TenantAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: "ok" }> {
    const rawRefreshToken = (req.cookies as Record<string, string> | undefined)?.[TENANT_REFRESH_COOKIE];
    if (rawRefreshToken && user.tenantId) {
      await this.authService.logoutTenant(rawRefreshToken, user.id, user.tenantId, requestMeta(req));
    }
    if (user.impersonation && user.tenantId) {
      await this.authService.endImpersonationSession(user.tenantId, user.impersonation.masterUserId);
    }
    clearAuthCookies(res, TENANT_ACCESS_COOKIE, TENANT_REFRESH_COOKIE);
    return { status: "ok" };
  }

  @Post("password-reset/request")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ status: "ok" }> {
    await this.authService.requestTenantPasswordReset(dto.email);
    // Resposta sempre idêntica, independente de o e-mail existir (ver SECURITY.md §1).
    return { status: "ok" };
  }

  @Post("password-reset/confirm")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto): Promise<{ status: "ok" }> {
    await this.authService.confirmTenantPasswordReset(dto.token, dto.novaSenha);
    return { status: "ok" };
  }

  @Get("me")
  @UseGuards(TenantAuthGuard)
  me(@CurrentUser() user: AuthenticatedRequestUser): AuthenticatedRequestUser {
    return user;
  }
}
