import { Injectable } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import { AuditService } from "../common/audit/audit.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ReportsService } from "../reports/reports.service";
import { resolvePeriod } from "../reports/dto/period.dto";
import type { PeriodQueryDto } from "../reports/dto/period.dto";
import type { UpdateAlertConfigDto } from "./dto/update-alert-config.dto";

type Severity = "critica" | "alta" | "media" | "informativa";
const SEVERITY_ORDER: Record<Severity, number> = { critica: 0, alta: 1, media: 2, informativa: 3 };

interface Action {
  id: string;
  titulo: string;
  descricao: string;
  quantidade: number;
  severidade: Severity;
  modulo: string;
  link: string;
}

function delta(current: number, previous: number | null): { valor: number; percentual: number | null } {
  if (previous === null) return { valor: current, percentual: null };
  if (previous === 0) return { valor: current, percentual: current === 0 ? 0 : null };
  return { valor: current - previous, percentual: Math.round(((current - previous) / previous) * 1000) / 10 };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  async getSummary(dto: PeriodQueryDto) {
    const tenantId = requireCurrentTenantId();
    const { current, previous, label, previousLabel } = resolvePeriod(dto);

    const flags = await this.prisma.featureFlag.findMany({ where: { tenantId, enabled: true } });
    const activeModules = new Set(flags.map((f) => f.module));

    const [crm, atendimento, operacional, alertConfig] = await Promise.all([
      activeModules.has("crm") ? this.crmSection(current, previous) : null,
      activeModules.has("atendimento") ? this.atendimentoSection(current, previous) : null,
      this.operationalSnapshot(tenantId, activeModules),
      this.getAlertConfig(),
    ]);

    const acoes = await this.buildActions(tenantId, activeModules, alertConfig);

    return {
      modulosAtivos: [...activeModules],
      periodo: { from: current.from, to: current.to, label },
      comparacao: previous ? { from: previous.from, to: previous.to, label: previousLabel } : null,
      crm,
      atendimento,
      operacional,
      acoes,
    };
  }

  private async crmSection(current: { from: Date; to: Date }, previous: { from: Date; to: Date } | null) {
    const [curr, prev] = await Promise.all([
      this.reports.crm({ from: current.from.toISOString(), to: current.to.toISOString() }),
      previous ? this.reports.crm({ from: previous.from.toISOString(), to: previous.to.toISOString() }) : null,
    ]);

    return {
      atual: curr,
      anterior: prev,
      deltas: {
        contactsCreated: delta(curr.contactsCreated, prev?.contactsCreated ?? null),
        opportunitiesWon: delta(curr.opportunitiesWon, prev?.opportunitiesWon ?? null),
        opportunitiesWonValue: delta(curr.opportunitiesWonValue, prev?.opportunitiesWonValue ?? null),
        conversionRate: delta(curr.conversionRate, prev?.conversionRate ?? null),
      },
    };
  }

  private async atendimentoSection(current: { from: Date; to: Date }, previous: { from: Date; to: Date } | null) {
    const [curr, prev] = await Promise.all([
      this.reports.atendimento({ from: current.from.toISOString(), to: current.to.toISOString() }),
      previous ? this.reports.atendimento({ from: previous.from.toISOString(), to: previous.to.toISOString() }) : null,
    ]);

    const totalOf = (data: typeof curr) => data.conversationsByStatus.reduce((sum, g) => sum + g.count, 0);
    const closedOf = (data: typeof curr) => data.conversationsByStatus.find((g) => g.status === "closed")?.count ?? 0;

    return {
      atual: curr,
      anterior: prev,
      deltas: {
        total: delta(totalOf(curr), prev ? totalOf(prev) : null),
        fechadas: delta(closedOf(curr), prev ? closedOf(prev) : null),
      },
    };
  }

  /** "Visão operacional agora" — nunca afetado pelo filtro de período. */
  private async operationalSnapshot(tenantId: string, activeModules: Set<string>) {
    const onlineUsers = this.realtime.getOnlineUsers(tenantId);
    const onlineIds = new Set(onlineUsers.map((u) => u.userId));

    const result: Record<string, unknown> = {
      atendentesOnline: onlineUsers.length,
    };

    if (activeModules.has("atendimento")) {
      const [conversasAguardando, totalAgentes, filasAbertas] = await Promise.all([
        this.prisma.conversation.count({ where: { tenantId, deletedAt: null, status: "open", responsavelId: null, queueId: { not: null } } }),
        this.prisma.tenantUser.count({ where: { tenantId, status: "active" } }),
        this.prisma.queue.count({ where: { tenantId, ativo: true } }),
      ]);
      result.conversasAguardando = conversasAguardando;
      result.atendentesOffline = Math.max(totalAgentes - onlineIds.size, 0);
      result.filasAbertas = filasAbertas;
    }

    if (activeModules.has("crm")) {
      const [oportunidadesSemResponsavel, tarefasVencidas] = await Promise.all([
        this.prisma.opportunity.count({ where: { tenantId, deletedAt: null, status: "open", responsavelId: null } }),
        this.prisma.crmTask.count({ where: { tenantId, status: "pending", dataHora: { lt: new Date() } } }),
      ]);
      result.oportunidadesSemResponsavel = oportunidadesSemResponsavel;
      result.tarefasVencidas = tarefasVencidas;
    }

    return result;
  }

  private async buildActions(tenantId: string, activeModules: Set<string>, config: Awaited<ReturnType<typeof this.getAlertConfig>>): Promise<Action[]> {
    const actions: Action[] = [];
    const now = new Date();

    if (activeModules.has("atendimento")) {
      const waitThreshold = new Date(now.getTime() - config.queueWaitMinutes * 60 * 1000);
      const conversasEsperando = await this.prisma.conversation.count({
        where: { tenantId, deletedAt: null, status: "open", responsavelId: null, queueId: { not: null }, createdAt: { lt: waitThreshold } },
      });
      if (conversasEsperando > 0) {
        actions.push({
          id: "atendimento_espera",
          titulo: "Conversas aguardando atendimento",
          descricao: `Esperando há mais de ${config.queueWaitMinutes} minutos.`,
          quantidade: conversasEsperando,
          severidade: "critica",
          modulo: "atendimento",
          link: "/painel/atendimento",
        });
      }
    }

    if (activeModules.has("crm")) {
      const stagnantThreshold = new Date(now.getTime() - config.opportunityStagnantDays * 24 * 60 * 60 * 1000);
      const [oportunidadesParadas, tarefasVencidas, oportunidadesSemResponsavel] = await Promise.all([
        this.prisma.opportunity.count({ where: { tenantId, deletedAt: null, status: "open", updatedAt: { lt: stagnantThreshold } } }),
        this.prisma.crmTask.count({ where: { tenantId, status: "pending", dataHora: { lt: now } } }),
        this.prisma.opportunity.count({ where: { tenantId, deletedAt: null, status: "open", responsavelId: null } }),
      ]);

      if (oportunidadesParadas > 0) {
        actions.push({
          id: "crm_estagnadas",
          titulo: "Oportunidades sem movimentação",
          descricao: `Sem atualização há mais de ${config.opportunityStagnantDays} dias.`,
          quantidade: oportunidadesParadas,
          severidade: "alta",
          modulo: "crm",
          link: "/painel/crm/funil",
        });
      }
      if (config.taskOverdueEnabled && tarefasVencidas > 0) {
        actions.push({
          id: "crm_tarefas_vencidas",
          titulo: "Tarefas vencidas",
          descricao: "Tarefas com prazo já ultrapassado.",
          quantidade: tarefasVencidas,
          severidade: "critica",
          modulo: "crm",
          link: "/painel/crm/tarefas",
        });
      }
      if (oportunidadesSemResponsavel > 0) {
        actions.push({
          id: "crm_sem_responsavel",
          titulo: "Oportunidades sem responsável",
          descricao: "Nenhum atendente atribuído.",
          quantidade: oportunidadesSemResponsavel,
          severidade: "media",
          modulo: "crm",
          link: "/painel/crm/funil",
        });
      }
    }

    if (activeModules.has("whatsapp")) {
      const desconectados = await this.prisma.whatsAppNumber.count({ where: { tenantId, deletedAt: null, status: { not: "connected" } } });
      if (desconectados > 0) {
        actions.push({
          id: "whatsapp_desconectado",
          titulo: "Números do WhatsApp desconectados",
          descricao: "Verifique a conexão para não perder mensagens.",
          quantidade: desconectados,
          severidade: "critica",
          modulo: "whatsapp",
          link: "/painel/whatsapp",
        });
      }
    }

    return actions.sort((a, b) => SEVERITY_ORDER[a.severidade] - SEVERITY_ORDER[b.severidade]);
  }

  async getAlertConfig() {
    const tenantId = requireCurrentTenantId();
    const existing = await this.prisma.dashboardAlertConfig.findUnique({ where: { tenantId } });
    if (existing) return existing;
    return this.prisma.dashboardAlertConfig.create({ data: { tenantId } });
  }

  async updateAlertConfig(dto: UpdateAlertConfigDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const previous = await this.getAlertConfig();

    const updated = await this.prisma.dashboardAlertConfig.update({
      where: { tenantId },
      data: dto,
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "dashboard.alert_config.update",
      entity: "DashboardAlertConfig",
      entityId: updated.id,
      tenantId,
      previousData: previous as unknown as Prisma.InputJsonValue,
      newData: updated as unknown as Prisma.InputJsonValue,
    });

    return updated;
  }
}
