import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Body } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { MasterAuthService } from "./master-auth.service";
import { LoginDto } from "./dto/login.dto";
import { loginSchema } from "@chatbot-saas/validation";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { MASTER_ACCESS_COOKIE, MASTER_REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "./cookie.util";
import { MasterAuthGuard } from "./guards/master-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthenticatedRequestUser } from "./jwt-payload.interface";
import type { RequestMeta } from "./auth.service";

function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.get("user-agent") };
}

@Controller("auth/master")
export class MasterAuthController {
  constructor(private readonly masterAuthService: MasterAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: "ok" }> {
    const session = await this.masterAuthService.login(dto, requestMeta(req));
    setAuthCookies(res, MASTER_ACCESS_COOKIE, session.accessToken, MASTER_REFRESH_COOKIE, session.refreshToken, session.refreshTtlMs);
    return { status: "ok" };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ status: "ok" }> {
    const rawRefreshToken = (req.cookies as Record<string, string> | undefined)?.[MASTER_REFRESH_COOKIE];
    if (!rawRefreshToken) {
      throw new UnauthorizedException("Refresh token ausente.");
    }
    const session = await this.masterAuthService.refresh(rawRefreshToken);
    setAuthCookies(res, MASTER_ACCESS_COOKIE, session.accessToken, MASTER_REFRESH_COOKIE, session.refreshToken, session.refreshTtlMs);
    return { status: "ok" };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(MasterAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: "ok" }> {
    const rawRefreshToken = (req.cookies as Record<string, string> | undefined)?.[MASTER_REFRESH_COOKIE];
    if (rawRefreshToken) {
      await this.masterAuthService.logout(rawRefreshToken, user.id, requestMeta(req));
    }
    clearAuthCookies(res, MASTER_ACCESS_COOKIE, MASTER_REFRESH_COOKIE);
    return { status: "ok" };
  }

  @Get("me")
  @UseGuards(MasterAuthGuard)
  async me(@CurrentUser() user: AuthenticatedRequestUser) {
    const profile = await this.masterAuthService.getProfile(user.id);
    return { ...user, nome: profile?.nome ?? null, email: profile?.email ?? null };
  }
}
