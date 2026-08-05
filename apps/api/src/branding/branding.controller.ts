import { Controller, Get, UseGuards } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { MasterAuthGuard } from "../auth/guards/master-auth.guard";
import { BrandingService } from "./branding.service";

@Controller("branding")
export class BrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get("tenant")
  @UseGuards(TenantAuthGuard)
  getTenantBranding() {
    return this.service.getTenantBranding();
  }

  @Get("master")
  @UseGuards(MasterAuthGuard)
  getMasterBranding() {
    return this.service.getMasterBranding();
  }

  // Sem guard — precisa estar acessível na tela de login, antes de qualquer autenticação.
  @Get("site")
  getSiteBranding() {
    return this.service.getSiteBranding();
  }
}
