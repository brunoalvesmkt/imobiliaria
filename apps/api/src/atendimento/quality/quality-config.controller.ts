import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { QualityConfigService } from "./quality-config.service";
import { UpdateQualityConfigDto } from "./dto/update-quality-config.dto";

/** Mesmo gate do resto da Funcionalidade 12 ("qualidade_ia") — configurar os critérios exige o módulo ativo. */
@Controller("atendimento/quality-config")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("qualidade_ia")
export class QualityConfigController {
  constructor(private readonly service: QualityConfigService) {}

  @Get()
  @RequirePermission("atendimento", "view")
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermission("atendimento", "administer")
  update(@Body() dto: UpdateQualityConfigDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(dto, user.id);
  }
}
