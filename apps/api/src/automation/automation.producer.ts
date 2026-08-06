import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

@Injectable()
export class AutomationProducer {
  constructor(@InjectQueue("automations") private readonly queue: Queue) {}

  /** jobId = executionId — dedupe estrutural no próprio BullMQ contra enfileiramento duplicado (ver ACCEPTANCE_CRITERIA.md, caso crítico #8). `chainDepth` propaga a profundidade na corrente de automações (ver automation-chain-context.ts) para o processor reconstituir o contexto ao rodar esse job. */
  enqueueExecution(executionId: string, chainDepth = 0): Promise<unknown> {
    return this.queue.add(
      "run_execution",
      { executionId, chainDepth },
      {
        jobId: `execution-${executionId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false, // preserva o job para inspeção — o estado real fica em AutomationExecution.status='dead_letter'
      },
    );
  }

  /** Reenfileira o mesmo job "run_execution" para retomar uma execução pausada por um passo "wait" (Fase E) — `jobId` determinístico por índice evita duplicar a retomada em caso de reentrega do BullMQ. */
  enqueueResume(executionId: string, resumeFromIndex: number, delayMs: number): Promise<unknown> {
    return this.queue.add(
      "run_execution",
      { executionId, resumeFromIndex },
      {
        jobId: `resume-${executionId}-${resumeFromIndex}`,
        delay: delayMs,
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false,
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
