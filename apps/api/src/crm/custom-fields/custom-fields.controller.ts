import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { CustomFieldsService } from "./custom-fields.service";
import { CreateCustomFieldDto } from "./dto/create-custom-field.dto";
import { UpdateCustomFieldDto } from "./dto/update-custom-field.dto";

@Controller("crm/custom-fields")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class CustomFieldsController {
  constructor(private readonly service: CustomFieldsService) {}

  @Get()
  @RequirePermission("crm", "view")
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission("crm", "administer")
  create(@Body() dto: CreateCustomFieldDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateCustomFieldDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }
}
