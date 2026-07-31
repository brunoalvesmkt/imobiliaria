import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { MasterAuthGuard } from "../../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../../common/master-roles/master-roles.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { PlansService } from "./plans.service";
import { CreatePlanDto } from "./dto/create-plan.dto";
import { UpdatePlanDto } from "./dto/update-plan.dto";

@Controller("master/plans")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
export class PlansController {
  constructor(private readonly service: PlansService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get("export")
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="planos.csv"');
    res.send(csv);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequireMasterRole("super_admin")
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.create(dto, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }

  @Patch(":id")
  @RequireMasterRole("super_admin")
  update(
    @Param("id") id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }
}
