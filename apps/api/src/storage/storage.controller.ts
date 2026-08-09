import { Controller, Get, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { StorageService } from "./storage.service";

@Controller("storage")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class StorageController {
  constructor(private readonly service: StorageService) {}

  @Get("usage")
  @RequirePermission("configuracoes", "view")
  getUsage() {
    return this.service.getUsage();
  }
}
