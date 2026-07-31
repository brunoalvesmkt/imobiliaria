import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

@Injectable()
export class AutomationProducer {
  constructor(@InjectQueue("automations") private readonly queue: Queue) {}

  /** jobId = executionId — dedupe estrutural no próprio BullMQ contra enfileiramento duplicado (ver ACCEPTANCE_CRITERIA.md, caso crítico #8). */
  enqueueExecution(executionId: string): Promise<unknown> {
    return this.queue.add(
      "run_execution",
      { executionId },
      {
        jobId: `execution-${executionId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false, // preserva o job para inspeção — o estado real fica em AutomationExecution.status='dead_letter'
      },
    );
  }

  enqueueFollowUp(followUpId: string, delayMs: number): Promise<unknown> {
    return this.queue.add(
      "send_followup",
      { followUpId },
      { jobId: `followup-${followUpId}`, delay: delayMs, removeOnComplete: true, removeOnFail: true },
    );
  }

  async cancelFollowUp(followUpId: string): Promise<void> {
    const job = await this.queue.getJob(`followup-${followUpId}`);
    if (job) {
      await job.remove();
    }
  }
}
