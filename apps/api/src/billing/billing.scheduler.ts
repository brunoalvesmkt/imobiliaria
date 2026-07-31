import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { BillingService } from "./billing.service";

/**
 * Job repetível diário que roda a verificação de cobrança recorrente
 * (`BillingService.runRenewalCheck`) — mesma lógica exposta manualmente em
 * `POST /master/billing/run-renewal-check` para uso administrativo/testes,
 * já que esperar o cron real disparar (24h) não é viável em teste automatizado.
 */
@Injectable()
@Processor("billing")
export class BillingScheduler extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(
    @InjectQueue("billing") private readonly queue: Queue,
    private readonly billing: BillingService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      "daily-renewal-check",
      { pattern: "0 3 * * *" }, // 03h todo dia
      { name: "run_renewal_check", opts: { removeOnComplete: true, removeOnFail: true } },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== "run_renewal_check") return;
    try {
      await this.billing.runRenewalCheck();
    } catch (error) {
      this.logger.error(`Falha na verificação de cobrança recorrente: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
