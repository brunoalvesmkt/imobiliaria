import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AuditService } from "../common/audit/audit.service";
import { NOTIFICATION_TYPES, findNotificationType, renderNotificationText } from "./notification-types";
import type { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";

export interface NotificationTemplateView {
  tipo: string;
  titulo: string;
  corpo: string;
  critical: boolean;
  ativo: boolean;
  placeholders: { key: string; label: string }[];
  customized: boolean;
}

/**
 * Título/corpo/criticidade de cada tipo de notificação (ver `notification-types.ts` para o catálogo
 * e os textos padrão) — um tenant pode sobrescrever qualquer um dos três por tipo; sem override, usa
 * o padrão. `render()` é o único método chamado fora do contexto de requisição de um tenant (a partir
 * de `NotificationsListener`), por isso recebe `tenantId` explícito em vez de usar `requireCurrentTenantId()`
 * — mesmo motivo documentado em `NotificationsService.sendWhatsappAdmin`.
 */
@Injectable()
export class NotificationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<NotificationTemplateView[]> {
    const tenantId = requireCurrentTenantId();
    const overrides = await this.prisma.notificationTemplate.findMany({ where: { tenantId } });
    const byTipo = new Map(overrides.map((o) => [o.tipo, o]));

    return NOTIFICATION_TYPES.map((def) => {
      const override = byTipo.get(def.tipo);
      return {
        tipo: def.tipo,
        titulo: override?.titulo ?? def.defaultTitulo,
        corpo: override?.corpo ?? def.defaultCorpo,
        critical: override?.critical ?? def.critical,
        ativo: override?.ativo ?? true,
        placeholders: def.placeholders,
        customized: !!override,
      };
    });
  }

  async update(tipo: string, dto: UpdateNotificationTemplateDto, actorId: string): Promise<NotificationTemplateView> {
    const tenantId = requireCurrentTenantId();
    const def = findNotificationType(tipo);
    if (!def) {
      throw new NotFoundException("Tipo de notificação não encontrado.");
    }

    const existing = await this.prisma.notificationTemplate.findUnique({ where: { tenantId_tipo: { tenantId, tipo } } });
    const titulo = dto.titulo ?? existing?.titulo ?? def.defaultTitulo;
    const corpo = dto.corpo ?? existing?.corpo ?? def.defaultCorpo;
    const critical = dto.critical ?? existing?.critical ?? def.critical;
    const ativo = dto.ativo ?? existing?.ativo ?? true;

    await this.prisma.notificationTemplate.upsert({
      where: { tenantId_tipo: { tenantId, tipo } },
      create: { tenantId, tipo, titulo, corpo, critical, ativo },
      update: { titulo, corpo, critical, ativo },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "notifications.template.update",
      entity: "NotificationTemplate",
      entityId: tipo,
      tenantId,
      newData: { titulo, corpo, critical, ativo },
    });

    return { tipo, titulo, corpo, critical, ativo, placeholders: def.placeholders, customized: true };
  }

  async reset(tipo: string, actorId: string): Promise<NotificationTemplateView> {
    const tenantId = requireCurrentTenantId();
    const def = findNotificationType(tipo);
    if (!def) {
      throw new NotFoundException("Tipo de notificação não encontrado.");
    }

    await this.prisma.notificationTemplate.deleteMany({ where: { tenantId, tipo } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "notifications.template.reset",
      entity: "NotificationTemplate",
      entityId: tipo,
      tenantId,
    });

    return {
      tipo,
      titulo: def.defaultTitulo,
      corpo: def.defaultCorpo,
      critical: def.critical,
      ativo: true,
      placeholders: def.placeholders,
      customized: false,
    };
  }

  /**
   * Monta título/corpo (com os placeholders de `values` já substituídos) e resolve se este disparo é
   * crítico (dispara WhatsApp administrativo) — chamado pelo `NotificationsListener` fora do contexto
   * de tenant resolvido, por isso recebe `tenantId` direto em vez de `requireCurrentTenantId()`.
   */
  async render(
    tenantId: string,
    tipo: string,
    values: Record<string, string>,
  ): Promise<{ titulo: string; corpo: string; critical: boolean; ativo: boolean }> {
    const def = findNotificationType(tipo);
    if (!def) {
      throw new Error(`Tipo de notificação desconhecido: ${tipo}`);
    }

    const override = await this.prisma.notificationTemplate.findUnique({ where: { tenantId_tipo: { tenantId, tipo } } });
    const tituloTemplate = override?.titulo ?? def.defaultTitulo;
    const corpoTemplate = override?.corpo ?? def.defaultCorpo;
    const critical = override?.critical ?? def.critical;
    const ativo = override?.ativo ?? true;

    return {
      titulo: renderNotificationText(tituloTemplate, values),
      corpo: renderNotificationText(corpoTemplate, values),
      critical,
      ativo,
    };
  }
}
