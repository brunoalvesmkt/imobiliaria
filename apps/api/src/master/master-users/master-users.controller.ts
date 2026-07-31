import { Body, Controller, Get, Param, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { MasterAuthGuard } from "../../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../../common/master-roles/master-roles.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { MasterUsersService } from "./master-users.service";
import { CreateMasterUserDto } from "./dto/create-master-user.dto";
import { UpdateMasterUserDto } from "./dto/update-master-user.dto";

@Controller("master/master-users")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
@RequireMasterRole("super_admin")
export class MasterUsersController {
  constructor(private readonly service: MasterUsersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get("export")
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="usuarios-master.csv"');
    res.send(csv);
  }

  @Post()
  create(@Body() dto: CreateMasterUserDto, @CurrentUser() user: AuthenticatedRequestUser, @Req() req: Request) {
    return this.service.create(dto, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateMasterUserDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.update(id, dto, { actorId: user.id, ip: req.ip, userAgent: req.get("user-agent") });
  }
}
