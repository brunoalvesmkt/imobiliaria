import { Injectable } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AuditService } from "../common/audit/audit.service";
import type { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";

export interface NotificationWhatsappSettings {
  whatsAppNumberId: string | null;
  destinoNumero: string | null;
}

const EMPTY_SETTINGS: NotificationWhatsappSettings = { whatsAppNumberId: null, destinoNumero: null };

interface ConfiguracoesFlagConfig {
  notificacaoWhatsapp?: NotificationWhatsappSettings;
}

/**
 * Canal opcional de notificação por WhatsApp administrativo (prompt mestre
 * §6) — complementa in-app (Fase 34) e e-mail (Fase 10.2): quando
 * configurado, eventos críticos também disparam uma mensagem para um número
 * de WhatsApp interno da empresa (não um contato do CRM), usando um dos
 * `WhatsAppNumber` já conectados como remetente. Guardado no
 * `FeatureFlag("configuracoes").config`, mesmo padrão livre já usado por
 * `leadScoreThresholds`/`allowByok` — "configuracoes" nunca é desativado
 * pelo Master, então usa `upsert` em vez de assumir que a linha já existe.
 */
@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<NotificationWhatsappSettings> {
    const tenantId = requireCurrentTenantId();
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "configuracoes" } } });
    const config = (flag?.config as ConfiguracoesFlagConfig | null) ?? {};
    return config.notificacaoWhatsapp ?? EMPTY_SETTINGS;
  }

  async update(dto: UpdateNotificationSettingsDto, actorId: string): Promise<NotificationWhatsappSettings> {
    const tenantId = requireCurrentTenantId();
    const settings: NotificationWhatsappSettings = {
      whatsAppNumberId: dto.whatsAppNumberId ?? null,
      destinoNumero: dto.destinoNumero ?? null,
    };

    const existing = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "configuracoes" } } });
    const previousConfig = (existing?.config as ConfiguracoesFlagConfig | null) ?? {};
    const newConfig: ConfiguracoesFlagConfig = { ...previousConfig, notificacaoWhatsapp: settings };

    await this.prisma.featureFlag.upsert({
      where: { tenantId_module: { tenantId, module: "configuracoes" } },
      create: { tenantId, module: "configuracoes", enabled: true, config: newConfig as unknown as Prisma.InputJsonValue },
      update: { config: newConfig as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "notifications.whatsapp_settings.update",
      entity: "FeatureFlag",
      tenantId,
      newData: settings as unknown as Prisma.InputJsonValue,
    });

    return settings;
  }
}
