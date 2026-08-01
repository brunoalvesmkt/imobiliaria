import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { ContactOriginsService } from "./contact-origins.service";
import { CreateContactOriginDto } from "./dto/create-contact-origin.dto";
import { UpdateContactOriginDto } from "./dto/update-contact-origin.dto";

@Controller("crm/contact-origins")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class ContactOriginsController {
  constructor(private readonly service: ContactOriginsService) {}

  @Get()
  @RequirePermission("crm", "view")
  list() {
    return this.service.list();
  }

  @Post()
  @RequirePermission("crm", "administer")
  create(@Body() dto: CreateContactOriginDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateContactOriginDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("crm", "administer")
  remove(@Param("id") id: string, @Query("substitutaId") substitutaId: string | undefined, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, substitutaId, user.id);
  }
}
