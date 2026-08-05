import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { createContactSchema } from "@chatbot-saas/validation";
import { ZodValidationPipe } from "../../common/validation/zod-validation.pipe";
import { TenantAuthGuard } from "../../auth/guards/tenant-auth.guard";
import { ModuleActiveGuard } from "../../common/modules/module-active.guard";
import { PermissionsGuard } from "../../common/permissions/permissions.guard";
import { RequireModule } from "../../common/modules/require-module.decorator";
import { RequirePermission } from "../../common/permissions/permissions.decorator";
import { CurrentUser } from "../../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../../auth/jwt-payload.interface";
import { ContactsService } from "./contacts.service";
import { CreateContactDto } from "./dto/create-contact.dto";
import { UpdateContactDto } from "./dto/update-contact.dto";
import { BlockContactDto } from "./dto/block-contact.dto";
import { MergeContactsDto } from "./dto/merge-contacts.dto";
import { ImportContactsDto } from "./dto/import-contacts.dto";

@Controller("crm/contacts")
@UseGuards(TenantAuthGuard, ModuleActiveGuard, PermissionsGuard)
@RequireModule("crm")
export class ContactsController {
  constructor(private readonly service: ContactsService) {}

  @Get()
  @RequirePermission("crm", "view")
  list(
    @Query("search") search: string | undefined,
    @Query("origemId") origemId: string | undefined,
    @Query("responsavelId") responsavelId: string | undefined,
    @Query("phoneType") phoneType: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.service.list(search, user.roleId, origemId, responsavelId, phoneType);
  }

  @Get(":id")
  @RequirePermission("crm", "view")
  get(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.get(id, user.roleId);
  }

  @Post()
  @RequirePermission("crm", "create")
  create(@Body(new ZodValidationPipe(createContactSchema)) dto: CreateContactDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.create(dto, user.id);
  }

  @Patch(":id")
  @RequirePermission("crm", "edit")
  update(@Param("id") id: string, @Body() dto: UpdateContactDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(":id")
  @RequirePermission("crm", "delete")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.remove(id, user.id);
  }

  @Post(":id/deactivate")
  @RequirePermission("crm", "edit")
  deactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.deactivate(id, user.id);
  }

  @Post(":id/reactivate")
  @RequirePermission("crm", "edit")
  reactivate(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.reactivate(id, user.id);
  }

  @Get(":id/opportunities-timeline")
  @RequirePermission("crm", "view")
  opportunitiesTimeline(@Param("id") id: string) {
    return this.service.getOpportunitiesTimeline(id);
  }

  @Get(":id/history")
  @RequirePermission("crm", "view")
  history(@Param("id") id: string) {
    return this.service.history(id);
  }

  @Get(":id/lgpd/export")
  @RequirePermission("crm", "administer")
  exportPersonalData(@Param("id") id: string) {
    return this.service.exportPersonalData(id);
  }

  @Post(":id/lgpd/anonymize")
  @RequirePermission("crm", "administer")
  anonymize(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.anonymize(id, user.id);
  }

  @Post(":id/block")
  @RequirePermission("crm", "edit")
  block(@Param("id") id: string, @Body() dto: BlockContactDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.block(id, dto, user.id);
  }

  @Post(":id/unblock")
  @RequirePermission("crm", "edit")
  unblock(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.unblock(id, user.id);
  }

  @Post(":id/merge")
  @RequirePermission("crm", "administer")
  merge(@Param("id") id: string, @Body() dto: MergeContactsDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.merge(id, dto.duplicateId, user.id);
  }

  @Post("import")
  @RequirePermission("crm", "create")
  importContacts(@Body() dto: ImportContactsDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return dto.format === "xlsx" ? this.service.importXlsx(dto.content, user.id) : this.service.importCsv(dto.content, user.id);
  }
}
