import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { FlowsService } from "./flows.service";
import { CreateFlowDto } from "./dto/create-flow.dto";
import { UpdateFlowDto } from "./dto/update-flow.dto";
import { UpdateDefinitionDto } from "./dto/update-definition.dto";

@Controller("chatbot/flows")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("chatbot")
export class FlowsController {
  constructor(private readonly service: FlowsService) {}

  @Get()
  @RequirePermission("chatbot", "view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("chatbot", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Get(":id/definition")
  @RequirePermission("chatbot", "view")
  getDefinition(@Param("id") id: string) {
    return this.service.getCurrentVersion(id);
  }

  @Post()
  @RequirePermission("chatbot", "create")
  create(@Body() dto: CreateFlowDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("chatbot", "edit")
  update(@Param("id") id: string, @Body() dto: UpdateFlowDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(":id/duplicate")
  @RequirePermission("chatbot", "create")
  duplicate(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.duplicate(id, user.id);
  }

  @Patch(":id/definition")
  @RequirePermission("chatbot", "edit")
  updateDefinition(
    @Param("id") id: string,
    @Body() dto: UpdateDefinitionDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.updateDefinition(id, dto, user.id);
  }

  @Post(":id/publish")
  @RequirePermission("chatbot", "publish")
  publish(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.publish(id, user.id);
  }

  @Post(":id/pause")
  @RequirePermission("chatbot", "publish")
  pause(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.pause(id, user.id);
  }

  @Delete(":id")
  @RequirePermission("chatbot", "delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }

  @Post(":id/archive")
  @RequirePermission("chatbot", "delete")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.archive(id, user.id);
  }

  @Post(":id/new-version")
  @RequirePermission("chatbot", "edit")
  createNewVersion(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.createNewVersion(id, user.id);
  }
}
