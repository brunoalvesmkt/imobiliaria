import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AuditService } from "../common/audit/audit.service";
import { DEFAULT_LEAD_SCORE_THRESHOLDS, type LeadScoreThresholds } from "./lead-score.util";

interface CrmFeatureFlagConfig {
  leadScoreThresholds?: LeadScoreThresholds;
}

/**
 * Fase 42 (ver DEVELOPMENT_PLAN.md): faixas de classificação do Lead Score
 * editáveis por tenant — prompt mestre §4 ("Os intervalos deverão ser
 * editáveis"). Guardadas no mesmo `FeatureFlag.config` do módulo "crm",
 * mesmo padrão livre já usado por `allowByok`/`allowPlatformKey` do módulo
 * "ia" (Fase 11) — sem migration nova para isso.
 */
@Injectable()
export class LeadScoreConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<LeadScoreThresholds> {
    const tenantId = requireCurrentTenantId();
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    const config = (flag?.config as CrmFeatureFlagConfig | null) ?? {};
    return config.leadScoreThresholds ?? DEFAULT_LEAD_SCORE_THRESHOLDS;
  }

  async update(thresholds: LeadScoreThresholds, actorId: string): Promise<LeadScoreThresholds> {
    if (thresholds.morno >= thresholds.quente) {
      throw new BadRequestException("O limiar de 'morno' deve ser menor que o de 'quente'.");
    }

    const tenantId = requireCurrentTenantId();
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    if (!flag) {
      throw new NotFoundException("Módulo CRM não está ativo para esta empresa.");
    }

    const previousConfig = (flag.config as CrmFeatureFlagConfig | null) ?? {};
    const newConfig: CrmFeatureFlagConfig = { ...previousConfig, leadScoreThresholds: thresholds };

    await this.prisma.featureFlag.update({
      where: { tenantId_module: { tenantId, module: "crm" } },
      data: { config: newConfig as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "crm.lead_score_thresholds.update",
      entity: "FeatureFlag",
      entityId: flag.id,
      tenantId,
      previousData: { leadScoreThresholds: previousConfig.leadScoreThresholds ?? DEFAULT_LEAD_SCORE_THRESHOLDS } as unknown as Prisma.InputJsonValue,
      newData: { leadScoreThresholds: thresholds } as unknown as Prisma.InputJsonValue,
    });

    return thresholds;
  }
}
