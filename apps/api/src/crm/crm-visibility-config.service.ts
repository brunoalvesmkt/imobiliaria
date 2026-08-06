import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AuditService } from "../common/audit/audit.service";

export interface CrmVisibilityConfig {
  /** "todos": qualquer usuário do CRM vê oportunidades sem responsável, além das próprias. "especificos": só quem estiver em `semResponsavelUsuarioIds` (mais quem tem crm:administer, que já vê tudo). */
  semResponsavelModo: "todos" | "especificos";
  semResponsavelUsuarioIds: string[];
}

export const DEFAULT_CRM_VISIBILITY_CONFIG: CrmVisibilityConfig = {
  semResponsavelModo: "todos",
  semResponsavelUsuarioIds: [],
};

interface CrmFeatureFlagConfig {
  crmVisibility?: CrmVisibilityConfig;
}

/**
 * Quem vê oportunidades sem responsável no Kanban, além das próprias — "todos"
 * (padrão) ou uma lista específica de usuários. Guardado no mesmo
 * `FeatureFlag.config` do módulo "crm", mesmo padrão de
 * `LeadScoreConfigService` (Fase 42) — sem migration nova.
 */
@Injectable()
export class CrmVisibilityConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<CrmVisibilityConfig> {
    const tenantId = requireCurrentTenantId();
    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    const config = (flag?.config as CrmFeatureFlagConfig | null) ?? {};
    return config.crmVisibility ?? DEFAULT_CRM_VISIBILITY_CONFIG;
  }

  async update(input: { semResponsavelModo: "todos" | "especificos"; semResponsavelUsuarioIds?: string[] }, actorId: string): Promise<CrmVisibilityConfig> {
    const tenantId = requireCurrentTenantId();
    const usuarioIds = input.semResponsavelModo === "especificos" ? (input.semResponsavelUsuarioIds ?? []) : [];

    if (usuarioIds.length > 0) {
      const count = await this.prisma.tenantUser.count({ where: { id: { in: usuarioIds }, tenantId, deletedAt: null } });
      if (count !== usuarioIds.length) {
        throw new BadRequestException("Um ou mais usuários selecionados não existem ou não pertencem a esta empresa.");
      }
    }

    const flag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    if (!flag) {
      throw new NotFoundException("Módulo CRM não está ativo para esta empresa.");
    }

    const previousConfig = (flag.config as CrmFeatureFlagConfig | null) ?? {};
    const newVisibility: CrmVisibilityConfig = { semResponsavelModo: input.semResponsavelModo, semResponsavelUsuarioIds: usuarioIds };
    const newConfig: CrmFeatureFlagConfig = { ...previousConfig, crmVisibility: newVisibility };

    await this.prisma.featureFlag.update({
      where: { tenantId_module: { tenantId, module: "crm" } },
      data: { config: newConfig as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "crm.visibility_config.update",
      entity: "FeatureFlag",
      entityId: flag.id,
      tenantId,
      previousData: { crmVisibility: previousConfig.crmVisibility ?? DEFAULT_CRM_VISIBILITY_CONFIG } as unknown as Prisma.InputJsonValue,
      newData: { crmVisibility: newVisibility } as unknown as Prisma.InputJsonValue,
    });

    return newVisibility;
  }
}
