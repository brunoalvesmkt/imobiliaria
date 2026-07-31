import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { QualityService } from "./quality.service";

/**
 * Módulo próprio ("qualidade_ia"), separado de "atendimento" — o Master liga
 * ou desliga esta funcionalidade por empresa a qualquer momento (mesmo
 * toggle genérico de `FeatureFlag` usado por crm/whatsapp/chatbot/
 * automação) sem afetar o resto do Atendimento, que continua funcionando
 * normalmente com o módulo desativado (ver `ModuleActiveGuard`).
 * Além disso, só `administer` (gestor/admin) — o prompt mestre §2.2 reserva
 * "solicitar análise de atendimento" ao Gestor, não ao Atendente comum.
 */
@Controller("atendimento/inbox/:id/analysis")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("qualidade_ia")
export class QualityController {
  constructor(private readonly service: QualityService) {}

  @Get()
  @RequirePermission("atendimento", "administer")
  list(@Param("id") conversationId: string) {
    return this.service.list(conversationId);
  }

  @Post()
  @RequirePermission("atendimento", "administer")
  analyze(@Param("id") conversationId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.analyze(conversationId, user.id);
  }
}
