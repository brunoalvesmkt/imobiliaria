import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { NumbersService } from "./numbers.service";
import { NumberFlowsService } from "./number-flows.service";
import { CreateNumberDto } from "./dto/create-number.dto";
import { UpdateNumberDto } from "./dto/update-number.dto";
import { AcceptRiskDto } from "./dto/accept-risk.dto";
import { SetChatbotFlowDto } from "./dto/set-chatbot-flow.dto";
import { CreateNumberFlowDto } from "./dto/create-number-flow.dto";
import { UpdateNumberFlowDto } from "./dto/update-number-flow.dto";

@Controller("whatsapp/numbers")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("whatsapp")
export class NumbersController {
  constructor(
    private readonly service: NumbersService,
    private readonly flowsService: NumberFlowsService,
  ) {}

  @Get()
  @RequirePermission("whatsapp", "view")
  list() {
    return this.service.list();
  }

  @Get("risk-term")
  @RequirePermission("whatsapp", "view")
  getRiskTerm() {
    return this.service.getRiskTerm();
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

  @Patch(":id")
  @RequirePermission("whatsapp", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateNumberDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("whatsapp", "administer")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
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

  @Get(":id/flows")
  @RequirePermission("whatsapp", "view")
  listFlows(@Param("id") id: string) {
    return this.flowsService.list(id);
  }

  @Post(":id/flows")
  @RequirePermission("whatsapp", "administer")
  linkFlow(@Param("id") id: string, @Body() dto: CreateNumberFlowDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.flowsService.create(id, dto, user.id);
  }

  @Patch(":id/flows/:flowLinkId")
  @RequirePermission("whatsapp", "administer")
  updateFlowLink(
    @Param("id") id: string,
    @Param("flowLinkId") flowLinkId: string,
    @Body() dto: UpdateNumberFlowDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.flowsService.update(id, flowLinkId, dto, user.id);
  }

  @Patch(":id/flows/:flowLinkId/activate-any")
  @RequirePermission("whatsapp", "administer")
  activateAsAny(
    @Param("id") id: string,
    @Param("flowLinkId") flowLinkId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.flowsService.activateAsAny(id, flowLinkId, user.id);
  }

  @Delete(":id/flows/:flowLinkId")
  @RequirePermission("whatsapp", "administer")
  unlinkFlow(@Param("id") id: string, @Param("flowLinkId") flowLinkId: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.flowsService.remove(id, flowLinkId, user.id);
  }
}
