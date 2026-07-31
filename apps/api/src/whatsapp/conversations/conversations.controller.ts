import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { ConversationsService } from "./conversations.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { SimulateIncomingDto } from "./dto/simulate-incoming.dto";

@Controller("whatsapp/conversations")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("whatsapp")
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Get()
  @RequirePermission("whatsapp", "view")
  list(@Query("status") status?: string) {
    return this.service.list(status);
  }

  @Get(":id")
  @RequirePermission("whatsapp", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post(":id/messages")
  @RequirePermission("whatsapp", "send")
  sendMessage(
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.sendMessage(id, dto, user.id);
  }

  /**
   * Ferramenta de desenvolvimento: simula o recebimento de uma mensagem de
   * um cliente, para exercitar o fluxo completo de conversas sem depender
   * de uma ponte WhatsApp real. Autenticado normalmente (não é um webhook
   * público) — ver FakeUnofficialProvider para o contexto completo.
   */
  @Post("dev/simulate-incoming")
  @RequirePermission("whatsapp", "administer")
  simulateIncoming(@Body() dto: SimulateIncomingDto) {
    return this.service.handleIncoming(dto.whatsAppNumberId, {
      externalId: `dev-in-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fromNumero: dto.fromNumero,
      toIdentifier: dto.whatsAppNumberId,
      tipo: dto.tipo ?? "text",
      conteudo: dto.conteudo,
      midiaUrl: dto.midiaUrl,
      timestamp: new Date(),
    });
  }
}
