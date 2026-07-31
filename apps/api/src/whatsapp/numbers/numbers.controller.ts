import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { NumbersService } from "./numbers.service";
import { CreateNumberDto } from "./dto/create-number.dto";
import { AcceptRiskDto } from "./dto/accept-risk.dto";
import { SetChatbotFlowDto } from "./dto/set-chatbot-flow.dto";

@Controller("whatsapp/numbers")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("whatsapp")
export class NumbersController {
  constructor(private readonly service: NumbersService) {}

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
  @RequirePermission("whatsapp", "administer")
  create(@Body() dto: CreateNumberDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Post(":id/connect")
  @RequirePermission("whatsapp", "administer")
  connect(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.connect(id, user.id);
  }

  @Get(":id/qr")
  @RequirePermission("whatsapp", "administer")
  getQr(@Param("id") id: string) {
    return this.service.getQr(id);
  }

  @Post(":id/confirm-connection")
  @RequirePermission("whatsapp", "administer")
  confirmConnection(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.confirmConnection(id, user.id);
  }

  @Post(":id/disconnect")
  @RequirePermission("whatsapp", "administer")
  disconnect(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.disconnect(id, user.id);
  }

  @Post(":id/accept-risk")
  @RequirePermission("whatsapp", "administer")
  acceptRisk(
    @Param("id") id: string,
    @Body() dto: AcceptRiskDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.service.acceptRisk(id, dto, user.id, req.ip);
  }

  @Patch(":id/chatbot-flow")
  @RequirePermission("whatsapp", "administer")
  setChatbotFlow(
    @Param("id") id: string,
    @Body() dto: SetChatbotFlowDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.setChatbotFlow(id, dto, user.id);
  }
}
