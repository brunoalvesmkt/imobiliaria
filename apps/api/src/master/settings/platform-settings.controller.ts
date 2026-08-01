import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { MasterAuthGuard } from "../../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../../common/master-roles/master-roles.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { PlatformSettingsService } from "./platform-settings.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";

@Controller("master/settings")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
export class PlatformSettingsController {
  constructor(private readonly service: PlatformSettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  @RequireMasterRole("super_admin")
  update(@Body() dto: UpdatePlatformSettingsDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(dto, user.id);
  }
}
