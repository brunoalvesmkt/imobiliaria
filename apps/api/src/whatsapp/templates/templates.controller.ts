import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { TemplatesService } from "./templates.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";

@Controller("whatsapp/templates")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("whatsapp")
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  @RequirePermission("whatsapp", "view")
  list() {
    return this.service.list();
  }

  @Get(":id")
  @RequirePermission("whatsapp", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("whatsapp", "create")
  create(@Body() dto: CreateTemplateDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("whatsapp", "edit")
  update(@Param("id") id: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(":id/submit")
  @RequirePermission("whatsapp", "publish")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.submit(id, user.id);
  }

  @Post(":id/approve")
  @RequirePermission("whatsapp", "approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.setApproval(id, true, user.id);
  }

  @Post(":id/reject")
  @RequirePermission("whatsapp", "approve")
  reject(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.setApproval(id, false, user.id);
  }
}
