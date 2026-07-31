import { Body, Controller, Delete, Get, HttpCode, HttpStatus, NotFoundException, Param, Patch, UseGuards } from "@nestjs/common";
import { MasterAuthGuard } from "../auth/guards/master-auth.guard";
import { MasterRolesGuard } from "../common/master-roles/master-roles.guard";
import { RequireMasterRole } from "../common/master-roles/master-roles.decorator";
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

/**
 * Chaves de IA da própria plataforma (Fase 30, ver DEVELOPMENT_PLAN.md) —
 * antes só configuráveis via env var, agora o Master pode cadastrar/trocar
 * sem precisar de acesso ao servidor. Restrito a `super_admin`, mesmo nível
 * exigido para as demais configurações sensíveis do Master (módulos, RLS).
 */
@Controller("master/ai/platform-keys")
@UseGuards(MasterAuthGuard, MasterRolesGuard)
@RequireMasterRole("super_admin")
export class MasterAiSettingsController {
  constructor(private readonly service: AiAccessService) {}

  @Get()
  list() {
    return this.service.listPlatformKeys();
  }

  @Patch(":provider")
  async save(
    @Param("provider") provider: string,
    @Body() dto: SaveAiCredentialDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    assertValidProvider(provider);
    await this.service.savePlatformKey(provider, dto.apiKey, user.id);
    return { provider, saved: true };
  }

  @Delete(":provider")
  @HttpCode(HttpStatus.OK)
  async remove(@Param("provider") provider: string, @CurrentUser() user: AuthenticatedRequestUser) {
    assertValidProvider(provider);
    await this.service.deletePlatformKey(provider, user.id);
    return { provider, deleted: true };
  }
}
