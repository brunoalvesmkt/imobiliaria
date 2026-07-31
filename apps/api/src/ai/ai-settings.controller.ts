import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, UseGuards, NotFoundException } from "@nestjs/common";
import { TenantAuthGuard } from "../auth/guards/tenant-auth.guard";
import { PermissionsGuard } from "../common/permissions/permissions.guard";
import { RequirePermission } from "../common/permissions/permissions.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { AiAccessService } from "./ai-access.service";
import { AI_PROVIDER_NAMES, type AiProviderName } from "./providers/ai-provider-registry.service";
import { SaveAiCredentialDto } from "./dto/save-ai-credential.dto";

function assertValidProvider(provider: string): asserts provider is AiProviderName {
  if (!AI_PROVIDER_NAMES.includes(provider as AiProviderName)) {
    throw new NotFoundException(`Provedor de IA desconhecido: "${provider}".`);
  }
}

@Controller("ai")
@UseGuards(TenantAuthGuard, PermissionsGuard)
export class AiSettingsController {
  constructor(private readonly service: AiAccessService) {}

  @Get("access")
  @RequirePermission("configuracoes", "view")
  getAccess() {
    return this.service.getAccessSummary();
  }

  @Patch("credentials/:provider")
  @RequirePermission("configuracoes", "administer")
  async saveCredential(
    @Param("provider") provider: string,
    @Body() dto: SaveAiCredentialDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    assertValidProvider(provider);
    await this.service.saveCredential(provider, dto.apiKey, user.id);
    return { provider, saved: true };
  }

  @Delete("credentials/:provider")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("configuracoes", "administer")
  async deleteCredential(@Param("provider") provider: string, @CurrentUser() user: AuthenticatedRequestUser) {
    assertValidProvider(provider);
    await this.service.deleteCredential(provider, user.id);
    return { provider, deleted: true };
  }
}
