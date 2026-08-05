import { Body, Controller, Get, Patch, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { ModuleActiveGuard } from "../common/modules/module-active.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { DashboardService } from "./dashboard.service";
import { PeriodQueryDto } from "../reports/dto/period.dto";
import { UpdateAlertConfigDto } from "./dto/update-alert-config.dto";

/** "Início" é sempre disponível (não comercializado separadamente), mesmo raciocínio do `ReportsController.dashboard()`. */
@Controller("dashboard")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("summary")
  summary(@Query() dto: PeriodQueryDto) {
    return this.service.getSummary(dto);
  }

  @Get("alert-config")
  @RequirePermission("relatorios", "view")
  getAlertConfig() {
    return this.service.getAlertConfig();
  }

  @Patch("alert-config")
  @RequirePermission("relatorios", "administer")
  updateAlertConfig(@Body() dto: UpdateAlertConfigDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.updateAlertConfig(dto, user.id);
  }
}
