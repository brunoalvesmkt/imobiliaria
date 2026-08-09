import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationTemplatesService } from "../notifications/notification-templates.service";

/** Faixas de aviso, da maior para a menor — ver checkNotifyThreshold. */
const NOTIFY_TIERS = [100, 90, 80] as const;

export type StorageCategory = "imagensVideos" | "audios" | "documentos" | "outros";

export interface StorageUsageView {
  usedBytes: number;
  limitMb: number | null;
  unlimited: boolean;
  percentage: number | null;
  categories: Record<StorageCategory, number>;
  updatedAt: string | null;
}

const CATEGORY_COLUMN: Record<StorageCategory, "imagensVideosBytes" | "audiosBytes" | "documentosBytes" | "outrosBytes"> = {
  imagensVideos: "imagensVideosBytes",
  audios: "audiosBytes",
  documentos: "documentosBytes",
  outros: "outrosBytes",
};

/**
 * Controle de consumo de armazenamento por tenant (documento de alterações,
 * Fase 1) — contador PRÉ-AGREGADO em `TenantStorageUsage`, incrementado em
 * `confirmUpload`/decrementado na exclusão de arquivo (ver FilesService),
 * nunca recalculado varrendo todos os arquivos a cada tela aberta. A
 * `StorageReconciliationScheduler` corrige drift diariamente; `recalculate`
 * também fica disponível para correção manual pelo Master.
 */
@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly templates: NotificationTemplatesService,
  ) {}

  classifyMime(mimeType: string): StorageCategory {
    if (mimeType.startsWith("image/") || mimeType.startsWith("video/")) return "imagensVideos";
    if (mimeType.startsWith("audio/")) return "audios";
    if (
      mimeType === "application/pdf" ||
      mimeType.startsWith("application/vnd.") ||
      mimeType === "application/msword" ||
      mimeType.startsWith("text/")
    ) {
      return "documentos";
    }
    return "outros";
  }

  async recordFileAdded(tenantId: string, sizeBytes: number, mimeType: string): Promise<void> {
    const categoria = this.classifyMime(mimeType);
    const column = CATEGORY_COLUMN[categoria];
    await this.prisma.tenantStorageUsage.upsert({
      where: { tenantId },
      create: { tenantId, totalBytes: sizeBytes, [column]: sizeBytes },
      update: { totalBytes: { increment: sizeBytes }, [column]: { increment: sizeBytes } },
    });
    await this.checkNotifyThreshold(tenantId);
  }

  /** Clamp em 0 — nunca decrementa abaixo de zero (evita drift virar contador negativo). */
  async recordFileRemoved(tenantId: string, sizeBytes: number, mimeType: string): Promise<void> {
    const categoria = this.classifyMime(mimeType);
    const column = CATEGORY_COLUMN[categoria];
    const current = await this.prisma.tenantStorageUsage.findUnique({ where: { tenantId } });
    if (!current) return;

    const newTotal = Math.max(0, Number(current.totalBytes) - sizeBytes);
    const newCategoryValue = Math.max(0, Number(current[column]) - sizeBytes);

    await this.prisma.tenantStorageUsage.update({
      where: { tenantId },
      data: { totalBytes: newTotal, [column]: newCategoryValue },
    });

    await this.resetNotifyTierIfBelowThreshold(tenantId, newTotal);
  }

  /** Recomputa do zero somando todos os arquivos `uploaded`/não deletados — usado pela reconciliação diária e por correção manual do Master. */
  async recalculate(tenantId: string): Promise<StorageUsageView> {
    const files = await this.prisma.file.findMany({
      where: { tenantId, status: "uploaded", deletedAt: null },
      select: { tamanho: true, mimeType: true },
    });

    const totals: Record<"total" | StorageCategory, number> = {
      total: 0,
      imagensVideos: 0,
      audios: 0,
      documentos: 0,
      outros: 0,
    };
    for (const file of files) {
      totals.total += file.tamanho;
      totals[this.classifyMime(file.mimeType)] += file.tamanho;
    }

    await this.prisma.tenantStorageUsage.upsert({
      where: { tenantId },
      create: {
        tenantId,
        totalBytes: totals.total,
        imagensVideosBytes: totals.imagensVideos,
        audiosBytes: totals.audios,
        documentosBytes: totals.documentos,
        outrosBytes: totals.outros,
      },
      update: {
        totalBytes: totals.total,
        imagensVideosBytes: totals.imagensVideos,
        audiosBytes: totals.audios,
        documentosBytes: totals.documentos,
        outrosBytes: totals.outros,
      },
    });

    await this.checkNotifyThreshold(tenantId);
    return this.getUsageFor(tenantId);
  }

  /** Ordem de resolução do limite efetivo: unlimited > override do tenant > Plan.limites.armazenamentoMb > ilimitado por padrão. */
  private async resolveLimit(tenantId: string): Promise<{ limitMb: number | null; unlimited: boolean }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { storageLimitMb: true, storageUnlimited: true, plan: { select: { limites: true } } },
    });
    if (!tenant) return { limitMb: null, unlimited: true };
    if (tenant.storageUnlimited) return { limitMb: null, unlimited: true };
    if (tenant.storageLimitMb != null) return { limitMb: tenant.storageLimitMb, unlimited: false };

    const limites = tenant.plan?.limites as Record<string, number | undefined> | undefined;
    const planLimitMb = limites?.armazenamentoMb;
    if (planLimitMb != null) return { limitMb: planLimitMb, unlimited: false };

    return { limitMb: null, unlimited: true };
  }

  async getUsage(): Promise<StorageUsageView> {
    return this.getUsageFor(requireCurrentTenantId());
  }

  private async getUsageFor(tenantId: string): Promise<StorageUsageView> {
    const [usage, limit] = await Promise.all([
      this.prisma.tenantStorageUsage.findUnique({ where: { tenantId } }),
      this.resolveLimit(tenantId),
    ]);

    const usedBytes = usage ? Number(usage.totalBytes) : 0;
    const percentage = limit.unlimited || limit.limitMb == null ? null : (usedBytes / (limit.limitMb * 1024 * 1024)) * 100;

    return {
      usedBytes,
      limitMb: limit.limitMb,
      unlimited: limit.unlimited,
      percentage,
      categories: {
        imagensVideos: usage ? Number(usage.imagensVideosBytes) : 0,
        audios: usage ? Number(usage.audiosBytes) : 0,
        documentos: usage ? Number(usage.documentosBytes) : 0,
        outros: usage ? Number(usage.outrosBytes) : 0,
      },
      updatedAt: usage?.updatedAt.toISOString() ?? null,
    };
  }

  /** Versão em lote — evita N+1 na listagem de tenants do Master. */
  async getUsageForTenants(tenantIds: string[]): Promise<Record<string, StorageUsageView>> {
    if (tenantIds.length === 0) return {};

    const [usages, tenants] = await Promise.all([
      this.prisma.tenantStorageUsage.findMany({ where: { tenantId: { in: tenantIds } } }),
      this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, storageLimitMb: true, storageUnlimited: true, plan: { select: { limites: true } } },
      }),
    ]);

    const usageByTenant = new Map(usages.map((u) => [u.tenantId, u]));
    const result: Record<string, StorageUsageView> = {};

    for (const tenant of tenants) {
      const usage = usageByTenant.get(tenant.id);
      const usedBytes = usage ? Number(usage.totalBytes) : 0;

      let limitMb: number | null = null;
      let unlimited = true;
      if (tenant.storageUnlimited) {
        unlimited = true;
      } else if (tenant.storageLimitMb != null) {
        limitMb = tenant.storageLimitMb;
        unlimited = false;
      } else {
        const limites = tenant.plan?.limites as Record<string, number | undefined> | undefined;
        const planLimitMb = limites?.armazenamentoMb;
        if (planLimitMb != null) {
          limitMb = planLimitMb;
          unlimited = false;
        }
      }

      const percentage = unlimited || limitMb == null ? null : (usedBytes / (limitMb * 1024 * 1024)) * 100;

      result[tenant.id] = {
        usedBytes,
        limitMb,
        unlimited,
        percentage,
        categories: {
          imagensVideos: usage ? Number(usage.imagensVideosBytes) : 0,
          audios: usage ? Number(usage.audiosBytes) : 0,
          documentos: usage ? Number(usage.documentosBytes) : 0,
          outros: usage ? Number(usage.outrosBytes) : 0,
        },
        updatedAt: usage?.updatedAt.toISOString() ?? null,
      };
    }

    return result;
  }

  /**
   * Notificação de limite — dispara só quando o consumo CRUZA uma faixa
   * (80/90/100%) que ainda não tinha sido notificada (`lastNotifiedTier`),
   * evitando reenviar a cada upload. Sempre usa a maior faixa cruzada.
   */
  private async checkNotifyThreshold(tenantId: string): Promise<void> {
    const [usage, limit] = await Promise.all([
      this.prisma.tenantStorageUsage.findUnique({ where: { tenantId } }),
      this.resolveLimit(tenantId),
    ]);
    if (!usage || limit.unlimited || limit.limitMb == null) return;

    const percentage = (Number(usage.totalBytes) / (limit.limitMb * 1024 * 1024)) * 100;
    const tier = NOTIFY_TIERS.find((t) => percentage >= t && usage.lastNotifiedTier < t);
    if (!tier) return;

    await this.prisma.tenantStorageUsage.update({ where: { tenantId }, data: { lastNotifiedTier: tier } });

    const { titulo, corpo, critical, ativo } = await this.templates.render(tenantId, "storage.limit_reached", {
      percentual: String(Math.round(percentage)),
    });
    if (!ativo) return;
    await this.notifications.create({ tenantId, tipo: "storage.limit_reached", titulo, corpo, critical });
  }

  /** Volta a poder notificar de novo se o consumo cair abaixo de 80% depois de uma exclusão. */
  private async resetNotifyTierIfBelowThreshold(tenantId: string, newTotalBytes: number): Promise<void> {
    const limit = await this.resolveLimit(tenantId);
    if (limit.unlimited || limit.limitMb == null) return;

    const percentage = (newTotalBytes / (limit.limitMb * 1024 * 1024)) * 100;
    if (percentage < 80) {
      await this.prisma.tenantStorageUsage.update({ where: { tenantId }, data: { lastNotifiedTier: 0 } });
    }
  }
}
