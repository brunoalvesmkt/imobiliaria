import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { CreateKnowledgeItemDto } from "./dto/create-knowledge-item.dto";
import { UpdateKnowledgeItemDto } from "./dto/update-knowledge-item.dto";

@Controller("chatbot/knowledge-base")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("chatbot")
export class KnowledgeBaseController {
  constructor(private readonly service: KnowledgeBaseService) {}

  @Get()
  @RequirePermission("chatbot", "view")
  list(@Query("tipo") tipo?: string) {
    return this.service.list(tipo);
  }

  @Get(":id")
  @RequirePermission("chatbot", "view")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Post()
  @RequirePermission("chatbot", "administer")
  create(@Body() dto: CreateKnowledgeItemDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("chatbot", "administer")
  update(@Param("id") id: string, @Body() dto: UpdateKnowledgeItemDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("chatbot", "administer")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }
}
