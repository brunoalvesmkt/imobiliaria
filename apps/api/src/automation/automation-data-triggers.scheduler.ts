import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationEngineService } from "./automation-engine.service";
import { TRIGGER_PARAM_KEY } from "./automation-definition.types";

/**
 * Job repetível para os dois gatilhos da categoria "Data" (`crm_task.due_soon`,
 * `opportunity.stage_stagnant`) — diferente dos outros gatilhos, que reagem a
 * uma mutação via `DomainEventsService`, estes precisam de varredura
 * periódica (mesmo padrão de `CrmTasksOverdueScheduler`: BullMQ
 * `upsertJobScheduler`, cruza tenants com `PrismaService` cru). Cada
 * automação tem seu próprio parâmetro (`gatilhoParametros`), então em vez de
 * emitir um evento genérico (que seria recebido por TODAS as automações
 * daquele gatilho no tenant, ignorando o parâmetro de cada uma — ver
 * comentário em `AutomationEngineService.dispatchToAutomation`), esta classe
 * chama `dispatchToAutomation` diretamente para a automação específica que
 * bateu com a entidade encontrada.
 *
 * Deduplicação: em vez de guardar "já disparei para esta entidade", reaproveita
 * `Automation.cooldownMinutos` (Fase B) — se configurado com um valor maior
 * que o intervalo de varredura (ex.: 1440 = 1 dia), a mesma tarefa/oportunidade
 * não gera uma nova execução a cada hora.
 */
@Injectable()
@Processor("automation-data-triggers")
export class AutomationDataTriggersScheduler extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AutomationDataTriggersScheduler.name);

  constructor(
    @InjectQueue("automation-data-triggers") private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly engine: AutomationEngineService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "hourly-data-trigger-check",
      { pattern: "0 * * * *" }, // a cada hora
      { name: "run_data_trigger_check", opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "run_data_trigger_check") return;
    try {
      await this.runDueSoonCheck();
      await this.runStageStagnantCheck();
    } catch (error) {
      this.logger.error(`Falha na varredura de gatilhos por tempo: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async runDueSoonCheck(): Promise<{ matched: number }> {
    const automations = await this.prisma.automation.findMany({
      where: { gatilhoTipo: "crm_task.due_soon", status: "active" },
    });

    let matched = 0;
    for (const automation of automations) {
      const horasAntecedencia = this.readParam(automation.gatilhoParametros, "crm_task.due_soon");
      if (!horasAntecedencia) continue;

      const now = new Date();
      const limite = new Date(now.getTime() + horasAntecedencia * 3_600_000);
      const tasks = await this.prisma.crmTask.findMany({
        where: { tenantId: automation.tenantId, status: "pending", dataHora: { gte: now, lte: limite } },
      });

      for (const task of tasks) {
        matched++;
        await this.engine.dispatchToAutomation(automation, "crm_task.due_soon", {
          tenantId: automation.tenantId,
          contactId: task.contactId,
          data: { taskId: task.id, tipo: task.tipo, titulo: task.titulo },
        });
      }
    }
    return { matched };
  }

  async runStageStagnantCheck(): Promise<{ matched: number }> {
    const automations = await this.prisma.automation.findMany({
      where: { gatilhoTipo: "opportunity.stage_stagnant", status: "active" },
    });

    let matched = 0;
    for (const automation of automations) {
      const diasParado = this.readParam(automation.gatilhoParametros, "opportunity.stage_stagnant");
      if (!diasParado) continue;

      const limite = new Date(Date.now() - diasParado * 86_400_000);
      const stagnantHistories = await this.prisma.opportunityStageHistory.findMany({
        where: {
          exitedAt: null,
          enteredAt: { lte: limite },
          opportunity: { tenantId: automation.tenantId, status: "open", deletedAt: null },
        },
        include: { opportunity: true },
      });

      for (const history of stagnantHistories) {
        matched++;
        await this.engine.dispatchToAutomation(automation, "opportunity.stage_stagnant", {
          tenantId: automation.tenantId,
          contactId: history.opportunity.contactId,
          opportunityId: history.opportunity.id,
          data: { opportunityId: history.opportunity.id, stageId: history.stageId, diasParado },
        });
      }
    }
    return { matched };
  }

  private readParam(gatilhoParametros: unknown, gatilhoTipo: "crm_task.due_soon" | "opportunity.stage_stagnant"): number | null {
    const key = TRIGGER_PARAM_KEY[gatilhoTipo];
    if (!key) return null;
    const params = gatilhoParametros as Record<string, unknown> | null;
    const value = params?.[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  }
}
