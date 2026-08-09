import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "./storage.service";

/**
 * Job repetível diário (03h) que corrige drift do contador pré-agregado de
 * armazenamento — recalcula do zero somando os arquivos reais de cada
 * tenant (`StorageService.recalculate`), sem impactar a performance das
 * telas que só leem o contador já pronto. Mesmo padrão de
 * `BillingScheduler` (`upsertJobScheduler`).
 */
@Injectable()
@Processor("storage")
export class StorageReconciliationScheduler extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(StorageReconciliationScheduler.name);

  constructor(
    @InjectQueue("storage") private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "daily-storage-reconciliation",
      { pattern: "0 3 * * *" }, // 03h todo dia
      { name: "run_storage_reconciliation", opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "run_storage_reconciliation") return;

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const tenant of tenants) {
      try {
        await this.storage.recalculate(tenant.id);
      } catch (error) {
        this.logger.error(
          `Falha na reconciliação de armazenamento do tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
