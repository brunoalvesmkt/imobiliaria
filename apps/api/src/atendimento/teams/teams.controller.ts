import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { TeamsService } from "./teams.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { AddMemberDto } from "./dto/add-member.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";

@Controller("atendimento/teams")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("atendimento")
export class TeamsController {
  constructor(private readonly service: TeamsService) {}

  @Get()
  @RequirePermission("atendimento", "view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("atendimento", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("atendimento", "administer")
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Post(":id/deactivate")
  @RequirePermission("atendimento", "administer")
  deactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.deactivate(id, user.id);
  }

  @Post(":id/reactivate")
  @RequirePermission("atendimento", "administer")
  reactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.reactivate(id, user.id);
  }

  @Delete(":id")
  @RequirePermission("atendimento", "administer")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }

  @Post(":id/members")
  @RequirePermission("atendimento", "administer")
  addMember(@Param("id") id: string, @Body() dto: AddMemberDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.addMember(id, dto, user.id);
  }

  @Patch(":id/members/:tenantUserId")
  @RequirePermission("atendimento", "administer")
  updateMemberPriority(
    @Param("id") id: string,
    @Param("tenantUserId") tenantUserId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.updateMemberPriority(id, tenantUserId, dto, user.id);
  }

  @Delete(":id/members/:tenantUserId")
  @RequirePermission("atendimento", "administer")
  removeMember(
    @Param("id") id: string,
    @Param("tenantUserId") tenantUserId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.removeMember(id, tenantUserId, user.id);
  }
}
