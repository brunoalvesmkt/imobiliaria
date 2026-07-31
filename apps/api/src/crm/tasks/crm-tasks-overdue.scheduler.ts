import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { DomainEventsService } from "../../common/events/domain-events.service";

/**
 * Job repetível que marca retornos (`CrmTask`) vencidos como `overdue` e
 * emite `crm_task.overdue` — mesmo padrão do `BillingScheduler` (job
 * repetível + endpoint manual para uso administrativo/testes). Cruza
 * tenants de propósito (usa `PrismaService` cru, não o escopado), já que
 * roda fora de um contexto de requisição de um tenant específico.
 */
@Injectable()
@Processor("crm-tasks")
export class CrmTasksOverdueScheduler extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(CrmTasksOverdueScheduler.name);

  constructor(
    @InjectQueue("crm-tasks") private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "hourly-overdue-check",
      { pattern: "0 * * * *" }, // a cada hora
      { name: "run_overdue_check", opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "run_overdue_check") return;
    try {
      await this.runOverdueCheck();
    } catch (error) {
      this.logger.error(`Falha na verificação de retornos atrasados: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async runOverdueCheck(): Promise<{ overdue: number }> {
    const now = new Date();
    const overdueTasks = await this.prisma.crmTask.findMany({
      where: { status: "pending", dataHora: { lt: now } },
    });

    for (const task of overdueTasks) {
      await this.prisma.crmTask.update({ where: { id: task.id }, data: { status: "overdue" } });
      this.domainEvents.emit("crm_task.overdue", {
        tenantId: task.tenantId,
        contactId: task.contactId,
        data: { taskId: task.id, titulo: task.titulo, responsavelId: task.responsavelId },
      });
    }

    if (overdueTasks.length > 0) {
      this.logger.log(`Verificação de retornos: ${overdueTasks.length} tarefa(s) marcada(s) como atrasada(s).`);
    }

    return { overdue: overdueTasks.length };
  }
}
