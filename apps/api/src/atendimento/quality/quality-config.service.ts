import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { AuditService } from "../../common/audit/audit.service";
import { DEFAULT_QUALITY_CONFIG, type QualityConfig } from "./quality-config.types";

interface QualidadeIaFeatureFlagConfig {
  quality?: QualityConfig;
}

/**
 * Fase 43 (ver DEVELOPMENT_PLAN.md): critérios de avaliação de qualidade
 * (peso por critério, obrigatório, nota mínima) editáveis por tenant —
 * prompt mestre §12.2. Guardado em `FeatureFlag.config` do módulo
 * "qualidade_ia", mesmo padrão livre já usado por "ia" e pelos limiares de
 * Lead Score (Fase 42).
 */
@Injectable()
export class QualityConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<QualityConfig> {
    const tenantId = requireCurrentTenantId();
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "qualidade_ia" } } });
    const config = (flag?.config as QualidadeIaFeatureFlagConfig | null) ?? {};
    return config.quality ?? DEFAULT_QUALITY_CONFIG;
  }

  async update(input: QualityConfig, actorId: string): Promise<QualityConfig> {
    if (input.criterios.length === 0) {
      throw new BadRequestException("Informe ao menos um critério de avaliação.");
    }
    if (input.criterios.some((c) => !c.nome.trim())) {
      throw new BadRequestException("Todo critério precisa de um nome.");
    }
    if (input.notaMinima < 0 || input.notaMinima > 10) {
      throw new BadRequestException("A nota mínima deve estar entre 0 e 10.");
    }

    const tenantId = requireCurrentTenantId();
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "qualidade_ia" } } });
    if (!flag) {
      throw new NotFoundException("Módulo de Análise de Atendimento não está ativo para esta empresa.");
    }

    const previousConfig = (flag.config as QualidadeIaFeatureFlagConfig | null) ?? {};
    const newConfig: QualidadeIaFeatureFlagConfig = { ...previousConfig, quality: input };

    await this.prisma.featureFlag.update({
      where: { tenantId_module: { tenantId, module: "qualidade_ia" } },
      data: { config: newConfig as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "qualidade_ia.config.update",
      entity: "FeatureFlag",
      entityId: flag.id,
      tenantId,
      previousData: { quality: previousConfig.quality ?? DEFAULT_QUALITY_CONFIG } as unknown as Prisma.InputJsonValue,
      newData: { quality: input } as unknown as Prisma.InputJsonValue,
    });

    return input;
  }
}
