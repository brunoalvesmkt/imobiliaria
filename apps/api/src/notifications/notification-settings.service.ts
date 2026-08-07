import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AuditService } from "../common/audit/audit.service";
import type { UpdateNotificationSettingsDto } from "./dto/update-notification-settings.dto";
import type { CreateNotificationRecipientDto } from "./dto/create-notification-recipient.dto";
import type { UpdateNotificationRecipientDto } from "./dto/update-notification-recipient.dto";

export interface NotificationWhatsappSettings {
  whatsAppNumberId: string | null;
}

interface LegacyNotificationWhatsappSettings {
  whatsAppNumberId?: string | null;
  destinoNumero?: string | null;
}

const EMPTY_SETTINGS: NotificationWhatsappSettings = { whatsAppNumberId: null };

interface ConfiguracoesFlagConfig {
  notificacaoWhatsapp?: LegacyNotificationWhatsappSettings;
}

/**
 * Canal opcional de notificação por WhatsApp administrativo (prompt mestre §6) — complementa in-app
 * (Fase 34) e e-mail (Fase 10.2): quando configurado, eventos críticos também disparam uma mensagem
 * para números de WhatsApp internos da empresa (não contatos do CRM), usando um dos `WhatsAppNumber`
 * já conectados como remetente único (`whatsAppNumberId`, guardado em `FeatureFlag("configuracoes").config`,
 * mesmo padrão livre já usado por `leadScoreThresholds`/`allowByok`). Os destinatários (número de
 * destino, quais tipos cada um recebe, ativo/inativo) viraram uma tabela própria
 * (`NotificationWhatsappRecipient`) — o `destinoNumero` único que existia antes disso é migrado
 * automaticamente para um destinatário na primeira leitura (ver `listRecipients`).
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
    return { whatsAppNumberId: config.notificacaoWhatsapp?.whatsAppNumberId ?? EMPTY_SETTINGS.whatsAppNumberId };
  }

  async update(dto: UpdateNotificationSettingsDto, actorId: string): Promise<NotificationWhatsappSettings> {
    const tenantId = requireCurrentTenantId();
    const settings: NotificationWhatsappSettings = { whatsAppNumberId: dto.whatsAppNumberId ?? null };

    const existing = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "configuracoes" } } });
    const previousConfig = (existing?.config as ConfiguracoesFlagConfig | null) ?? {};
    // Preserva `destinoNumero` antigo no JSON (ainda não migrado, se for o caso) — só `listRecipients`
    // decide migrar, aqui a gente só atualiza o número de origem.
    const newConfig: ConfiguracoesFlagConfig = { notificacaoWhatsapp: { ...previousConfig.notificacaoWhatsapp, whatsAppNumberId: settings.whatsAppNumberId } };

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

  /** Quantos números podem ser cadastrados — igual à quantidade de usuários ativos do painel (inclui o admin principal). */
  private async recipientLimit(tenantId: string): Promise<number> {
    return this.prisma.tenantUser.count({ where: { tenantId, status: "active" } });
  }

  async listRecipients() {
    const tenantId = requireCurrentTenantId();
    await this.migrateLegacyDestino(tenantId);
    return this.prisma.notificationWhatsappRecipient.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
  }

  /** Migra o `destinoNumero` único (modelo antigo) para um destinatário de verdade, uma única vez. */
  private async migrateLegacyDestino(tenantId: string): Promise<void> {
    const existingCount = await this.prisma.notificationWhatsappRecipient.count({ where: { tenantId } });
    if (existingCount > 0) return;

    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "configuracoes" } } });
    const config = (flag?.config as ConfiguracoesFlagConfig | null) ?? {};
    const destinoNumero = config.notificacaoWhatsapp?.destinoNumero;
    if (!destinoNumero) return;

    await this.prisma.notificationWhatsappRecipient.create({
      data: { tenantId, numero: destinoNumero, tipos: [], ativo: true },
    });
  }

  async createRecipient(dto: CreateNotificationRecipientDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.migrateLegacyDestino(tenantId);

    const [count, limit] = await Promise.all([
      this.prisma.notificationWhatsappRecipient.count({ where: { tenantId } }),
      this.recipientLimit(tenantId),
    ]);
    if (count >= limit) {
      throw new BadRequestException(
        `Limite de números atingido (${limit}) — o número de destinatários é igual ao número de usuários do painel, incluindo o administrador principal.`,
      );
    }

    const recipient = await this.prisma.notificationWhatsappRecipient.create({
      data: { tenantId, nome: dto.nome ?? null, numero: dto.numero, tipos: dto.tipos ?? [] },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "notifications.whatsapp_recipient.create",
      entity: "NotificationWhatsappRecipient",
      entityId: recipient.id,
      tenantId,
      newData: { nome: recipient.nome, numero: recipient.numero, tipos: recipient.tipos },
    });

    return recipient;
  }

  private async getRecipient(id: string, tenantId: string) {
    const recipient = await this.prisma.notificationWhatsappRecipient.findFirst({ where: { id, tenantId } });
    if (!recipient) {
      throw new NotFoundException("Destinatário não encontrado.");
    }
    return recipient;
  }

  async updateRecipient(id: string, dto: UpdateNotificationRecipientDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.getRecipient(id, tenantId);

    const recipient = await this.prisma.notificationWhatsappRecipient.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.numero !== undefined ? { numero: dto.numero } : {}),
        ...(dto.tipos !== undefined ? { tipos: dto.tipos } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "notifications.whatsapp_recipient.update",
      entity: "NotificationWhatsappRecipient",
      entityId: id,
      tenantId,
    });

    return recipient;
  }

  async removeRecipient(id: string, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.getRecipient(id, tenantId);

    await this.prisma.notificationWhatsappRecipient.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "notifications.whatsapp_recipient.remove",
      entity: "NotificationWhatsappRecipient",
      entityId: id,
      tenantId,
    });

    return { status: "ok" as const };
  }

  async listDeliveries(recipientId: string) {
    const tenantId = requireCurrentTenantId();
    await this.getRecipient(recipientId, tenantId);
    return this.prisma.notificationWhatsappDelivery.findMany({
      where: { tenantId, recipientId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
}
