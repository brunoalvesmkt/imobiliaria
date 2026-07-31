import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { decryptSecret, encryptSecret } from "../common/crypto/secret-encryption.util";
import { AI_PROVIDER_NAMES, type AiProviderName } from "./providers/ai-provider-registry.service";

interface AiFeatureFlagConfig {
  allowByok?: boolean;
  allowPlatformKey?: boolean;
}

const PLATFORM_KEY_ENV_BY_PROVIDER: Record<AiProviderName, string> = {
  anthropic: "AI_PLATFORM_ANTHROPIC_API_KEY",
  openai: "AI_PLATFORM_OPENAI_API_KEY",
  google: "AI_PLATFORM_GOOGLE_API_KEY",
};

export interface AiProviderAccessSummary {
  provider: AiProviderName;
  hasOwnKey: boolean;
  platformKeyConfigured: boolean;
  usable: boolean;
}

export interface AiAccessSummary {
  enabled: boolean;
  allowByok: boolean;
  allowPlatformKey: boolean;
  providers: AiProviderAccessSummary[];
}

/**
 * Decide, para um tenant + provedor, qual chave de IA usar (ou nega o
 * acesso) — o "cérebro" da integração de IA. Nunca finge sucesso: se não há
 * chave utilizável, lança `ForbiddenException` com uma mensagem clara (mesma
 * filosofia do resto do projeto — ex.: aceite de risco do WhatsApp).
 *
 * Ordem de resolução: (1) FeatureFlag "ia" precisa estar habilitada para o
 * tenant; (2) se `allowByok` e o tenant tem uma `TenantAiCredential` própria
 * para o provedor, usa ela; (3) senão, se `allowPlatformKey` e existe a env
 * var da plataforma para o provedor, usa ela; (4) senão, nega.
 */
@Injectable()
export class AiAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private async getFeatureFlagConfig(tenantId: string): Promise<{ enabled: boolean; config: AiFeatureFlagConfig }> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "ia" } } });
    return {
      enabled: flag?.enabled ?? false,
      config: (flag?.config as AiFeatureFlagConfig | null) ?? {},
    };
  }

  /**
   * A chave da plataforma pode vir de dois lugares: um registro em
   * `PlatformAiCredential` (cadastrado pelo Master via UI, Fase 30) ou, na
   * ausência dele, a env var `AI_PLATFORM_*_API_KEY` (forma original, ainda
   * suportada para não quebrar ambientes já configurados sem passar pela
   * tela nova). O registro no banco tem prioridade.
   */
  private async platformKeyFor(provider: AiProviderName): Promise<string | undefined> {
    const stored = await this.prisma.platformAiCredential.findUnique({ where: { provider } });
    if (stored) {
      const encryptionKey = this.config.getOrThrow<string>("ENCRYPTION_KEY");
      return decryptSecret(stored.encryptedKey, encryptionKey);
    }
    return this.config.get<string>(PLATFORM_KEY_ENV_BY_PROVIDER[provider]) || undefined;
  }

  async resolveApiKey(provider: AiProviderName): Promise<string> {
    const tenantId = requireCurrentTenantId();
    const { enabled, config } = await this.getFeatureFlagConfig(tenantId);

    if (!enabled) {
      throw new ForbiddenException("Módulo de IA não está habilitado para esta empresa.");
    }

    if (config.allowByok) {
      const credential = await this.tenantPrisma.tenantAiCredential.findFirst({ where: { provider } });
      if (credential) {
        const encryptionKey = this.config.getOrThrow<string>("ENCRYPTION_KEY");
        return decryptSecret(credential.encryptedKey, encryptionKey);
      }
    }

    if (config.allowPlatformKey) {
      const platformKey = await this.platformKeyFor(provider);
      if (platformKey) {
        return platformKey;
      }
    }

    throw new ForbiddenException(
      `Nenhuma chave de IA disponível para o provedor "${provider}" — configure sua própria chave ou peça ao administrador da plataforma para liberar o uso da chave compartilhada.`,
    );
  }

  async getAccessSummary(): Promise<AiAccessSummary> {
    const tenantId = requireCurrentTenantId();
    const { enabled, config } = await this.getFeatureFlagConfig(tenantId);
    const allowByok = config.allowByok ?? false;
    const allowPlatformKey = config.allowPlatformKey ?? false;

    const ownCredentials = await this.tenantPrisma.tenantAiCredential.findMany({});
    const ownProviders = new Set(ownCredentials.map((c) => c.provider));

    const providers: AiProviderAccessSummary[] = await Promise.all(
      AI_PROVIDER_NAMES.map(async (provider) => {
        const hasOwnKey = ownProviders.has(provider);
        const platformKeyConfigured = Boolean(await this.platformKeyFor(provider));
        const usable = enabled && ((allowByok && hasOwnKey) || (allowPlatformKey && platformKeyConfigured));
        return { provider, hasOwnKey, platformKeyConfigured, usable };
      }),
    );

    return { enabled, allowByok, allowPlatformKey, providers };
  }

  async saveCredential(provider: AiProviderName, apiKey: string, actorId: string): Promise<void> {
    const tenantId = requireCurrentTenantId();
    const { config } = await this.getFeatureFlagConfig(tenantId);
    if (!config.allowByok) {
      throw new ForbiddenException("Esta empresa não tem permissão para cadastrar chave própria de IA.");
    }

    const encryptionKey = this.config.getOrThrow<string>("ENCRYPTION_KEY");
    const encryptedKey = encryptSecret(apiKey, encryptionKey);
    await this.tenantPrisma.tenantAiCredential.upsert({ provider, encryptedKey });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "ai_credential.save",
      entity: "TenantAiCredential",
      entityId: `${tenantId}:${provider}`,
      newData: { provider },
    });
  }

  async deleteCredential(provider: AiProviderName, actorId: string): Promise<void> {
    const tenantId = requireCurrentTenantId();
    await this.tenantPrisma.tenantAiCredential.delete(provider);

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "ai_credential.delete",
      entity: "TenantAiCredential",
      entityId: `${tenantId}:${provider}`,
    });
  }

  // -- Chaves da própria plataforma (Master), Fase 30 --------------------

  async listPlatformKeys(): Promise<{ provider: AiProviderName; hasKey: boolean; source: "database" | "env" | "none" }[]> {
    const stored = await this.prisma.platformAiCredential.findMany();
    const storedProviders = new Set(stored.map((c) => c.provider));

    return AI_PROVIDER_NAMES.map((provider) => {
      if (storedProviders.has(provider)) {
        return { provider, hasKey: true, source: "database" as const };
      }
      if (this.config.get<string>(PLATFORM_KEY_ENV_BY_PROVIDER[provider])) {
        return { provider, hasKey: true, source: "env" as const };
      }
      return { provider, hasKey: false, source: "none" as const };
    });
  }

  async savePlatformKey(provider: AiProviderName, apiKey: string, actorId: string): Promise<void> {
    const encryptionKey = this.config.getOrThrow<string>("ENCRYPTION_KEY");
    const encryptedKey = encryptSecret(apiKey, encryptionKey);
    await this.prisma.platformAiCredential.upsert({
      where: { provider },
      create: { provider, encryptedKey },
      update: { encryptedKey },
    });

    await this.audit.record({
      actorId,
      actorType: "master",
      tenantId: null,
      action: "platform_ai_credential.save",
      entity: "PlatformAiCredential",
      entityId: provider,
      newData: { provider },
    });
  }

  async deletePlatformKey(provider: AiProviderName, actorId: string): Promise<void> {
    await this.prisma.platformAiCredential.deleteMany({ where: { provider } });

    await this.audit.record({
      actorId,
      actorType: "master",
      tenantId: null,
      action: "platform_ai_credential.delete",
      entity: "PlatformAiCredential",
      entityId: provider,
    });
  }
}
