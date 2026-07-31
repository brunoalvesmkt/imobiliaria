import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ProviderRegistryService } from "../whatsapp/providers/provider-registry.service";

export interface CreateNotificationInput {
  tenantId: string;
  recipientUserId?: string | null;
  tipo: string;
  titulo: string;
  corpo: string;
  link?: string | null;
  /** Também dispara pelo canal WhatsApp administrativo, se configurado (ver NotificationSettingsService) — só para eventos que o próprio chamador considera críticos, não todo evento in-app. */
  critical?: boolean;
}

/**
 * Central de notificações in-app (prompt mestre §6) — cada evento de
 * domínio relevante (ver `NotificationsListener`) vira um registro aqui.
 * `recipientUserId` nulo significa "visível para toda a empresa" (ex.:
 * "nova conversa"); preenchido significa dirigida a um usuário específico
 * (ex.: "você recebeu uma transferência").
 *
 * `create()` usa o `PrismaService` cru (não o `TenantScopedPrismaService`)
 * porque é chamado a partir do listener de eventos de domínio
 * (`NotificationsListener`), que pode rodar fora do contexto de requisição
 * de um tenant — mesmo padrão já usado por `AutomationEngineService` e
 * `BillingService.runRenewalCheck`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly providers: ProviderRegistryService,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        recipientUserId: input.recipientUserId ?? null,
        tipo: input.tipo,
        titulo: input.titulo,
        corpo: input.corpo,
        link: input.link ?? null,
      },
    });

    this.realtime.emitToTenant(input.tenantId, "notification:new", notification);

    if (input.critical) {
      await this.sendWhatsappAdmin(input.tenantId, `${input.titulo}\n${input.corpo}`);
    }

    return notification;
  }

  /**
   * Canal opcional de notificação por WhatsApp administrativo (prompt
   * mestre §6) — best-effort: sem configuração ou com o número desconectado,
   * só loga e segue (nunca derruba a criação da notificação in-app por
   * causa disso).
   */
  private async sendWhatsappAdmin(tenantId: string, texto: string): Promise<void> {
    try {
      // Consulta direta (não via NotificationSettingsService, que depende do tenant ALS) —
      // `create()` é chamado a partir de listeners de evento que podem rodar fora de um contexto de tenant resolvido.
      const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "configuracoes" } } });
      const settings = (flag?.config as { notificacaoWhatsapp?: { whatsAppNumberId?: string | null; destinoNumero?: string | null } } | null)
        ?.notificacaoWhatsapp;
      if (!settings?.whatsAppNumberId || !settings.destinoNumero) {
        return;
      }

      const number = await this.prisma.whatsAppNumber.findFirst({ where: { id: settings.whatsAppNumberId, tenantId } });
      if (!number || number.status !== "connected") {
        return;
      }

      const provider = this.providers.resolve(number.provider);
      await provider.sendMessage(
        { id: number.id, tenantId: number.tenantId, numero: number.numero, externalAccountId: number.externalAccountId },
        settings.destinoNumero,
        { tipo: "text", texto },
      );
    } catch (error) {
      this.logger.warn(`Falha ao enviar notificação por WhatsApp administrativo: ${(error as Error).message}`);
    }
  }

  list(userId: string, unreadOnly: boolean) {
    return this.tenantPrisma.notification.findMany({
      where: {
        OR: [{ recipientUserId: null }, { recipientUserId: userId }],
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  unreadCount(userId: string) {
    return this.tenantPrisma.notification.count({
      where: { OR: [{ recipientUserId: null }, { recipientUserId: userId }], readAt: null },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.tenantPrisma.notification.findFirst({
      where: { id, OR: [{ recipientUserId: null }, { recipientUserId: userId }] },
    });
    if (!notification) {
      throw new NotFoundException("Notificação não encontrada.");
    }
    if (notification.readAt) {
      return notification;
    }
    return this.tenantPrisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.tenantPrisma.notification.updateMany({
      where: { OR: [{ recipientUserId: null }, { recipientUserId: userId }], readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
