import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { MasterAuthGuard } from "../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../common/master-roles/master-roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { AffiliatesService } from "./affiliates.service";
import { CreateAffiliateDto } from "./dto/create-affiliate.dto";
import { UpdateAffiliateStatusDto } from "./dto/update-affiliate-status.dto";
import { CreateCommissionDto } from "./dto/create-commission.dto";
import { SetAffiliatePasswordDto } from "./dto/set-affiliate-password.dto";

function actorFrom(user: AuthenticatedRequestUser, req: Request) {
  return { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") };
}

@Controller("master/affiliates")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
@RequireMasterRole("super_admin", "financeiro")
export class AffiliatesController {
  constructor(private readonly service: AffiliatesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get("export")
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="afiliados.csv"');
    res.send(csv);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  create(@Body() dto: CreateAffiliateDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.create(dto, actorFrom(user, req));
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAffiliateStatusDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.updateStatus(id, dto, actorFrom(user, req));
  }

  @Patch(":id/password")
  setPassword(
    @Param("id") id: string,
    @Body() dto: SetAffiliatePasswordDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.setPassword(id, dto.senha, actorFrom(user, req));
  }

  @Post(":id/commissions")
  createCommission(
    @Param("id") id: string,
    @Body() dto: CreateCommissionDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.createCommission(id, dto, actorFrom(user, req));
  }

  @Get(":id/commissions")
  listCommissions(@Param("id") id: string) {
    return this.service.listCommissions(id);
  }

  @Get(":id/referrals")
  listReferrals(@Param("id") id: string) {
    return this.service.listReferrals(id);
  }

  @Post(":id/referrals/pay-eligible")
  payEligible(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.payEligibleReferrals(id, actorFrom(user, req));
  }
}
