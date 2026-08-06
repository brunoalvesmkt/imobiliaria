import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../common/modules/module-active.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequireModule } from "../common/modules/require-module.decorator";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { CrmVisibilityConfigService } from "./crm-visibility-config.service";
import { UpdateCrmVisibilityConfigDto } from "./dto/update-crm-visibility-config.dto";

@Controller("crm/visibility-config")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class CrmVisibilityConfigController {
  constructor(private readonly service: CrmVisibilityConfigService) {}

  @Get()
  @RequirePermission("crm", "view")
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission("crm", "administer")
  update(@Body() dto: UpdateCrmVisibilityConfigDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(dto, user.id);
  }
}
