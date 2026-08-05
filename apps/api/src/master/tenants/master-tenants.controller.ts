import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import type { MasterRole, TenantStatus } from "@chatbot-saas/database";
import { MasterAuthGuard } from "../../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../../common/master-roles/master-roles.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { TENANT_ACCESS_COOKIE } from "../../auth/cookie.util";
import { MasterTenantsService } from "./master-tenants.service";
import { UpdateTenantStatusDto } from "./dto/update-tenant-status.dto";
import { AssignPlanDto } from "./dto/assign-plan.dto";
import { ToggleModuleDto } from "./dto/toggle-module.dto";
import { ImpersonateDto } from "./dto/impersonate.dto";
import { CreateManualTenantDto } from "./dto/create-manual-tenant.dto";
import { UpdateLoginEmailDto } from "./dto/update-login-email.dto";

function actorFrom(user: AuthenticatedRequestUser, req: Request) {
  return { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") };
}

@Controller("master/tenants")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
export class MasterTenantsController {
  constructor(private readonly service: MasterTenantsService) {}

  @Get()
  list(@Query("status") status?: TenantStatus) {
    return this.service.list(status);
  }

  @Get("export")
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="empresas.csv"');
    res.send(csv);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequireMasterRole("super_admin")
  createManual(@Body() dto: CreateManualTenantDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.createManual(dto, actorFrom(user, req));
  }

  @Get(":id/consumption")
  consumption(@Param("id") id: string) {
    return this.service.consumption(id);
  }

  @Get(":id/login-access")
  @RequireMasterRole("super_admin")
  getLoginAccess(@Param("id") id: string) {
    return this.service.getLoginAccess(id);
  }

  @Patch(":id/login-email")
  @RequireMasterRole("super_admin")
  updateLoginEmail(
    @Param("id") id: string,
    @Body() dto: UpdateLoginEmailDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.updateLoginEmail(id, dto, actorFrom(user, req));
  }

  @Post(":id/password-reset")
  @HttpCode(HttpStatus.OK)
  @RequireMasterRole("super_admin")
  resendPasswordReset(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.resendPasswordReset(id, actorFrom(user, req));
  }

  @Patch(":id/status")
  @RequireMasterRole("super_admin")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.updateStatus(id, dto, actorFrom(user, req));
  }

  @Patch(":id/plan")
  @RequireMasterRole("super_admin", "financeiro")
  assignPlan(
    @Param("id") id: string,
    @Body() dto: AssignPlanDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.assignPlan(id, dto, actorFrom(user, req));
  }

  @Patch(":id/modules")
  @RequireMasterRole("super_admin")
  toggleModule(
    @Param("id") id: string,
    @Body() dto: ToggleModuleDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.toggleModule(id, dto, actorFrom(user, req));
  }

  @Post(":id/impersonate")
  @HttpCode(HttpStatus.OK)
  @RequireMasterRole("super_admin", "suporte")
  async impersonate(
    @Param("id") id: string,
    @Body() dto: ImpersonateDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.impersonate(
      id,
      dto,
      { id: user.id, role: user.masterRole as MasterRole },
      actorFrom(user, req),
    );

    res.cookie(TENANT_ACCESS_COOKIE, result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });

    return { tenantId: result.tenantId, accessLevel: result.accessLevel };
  }
}
