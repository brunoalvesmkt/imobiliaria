import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

export interface ChatbotTimeoutJobData {
  executionId: string;
  nodeId: string;
  targetNodeId: string;
}

/**
 * Reengajamento por timeout dos cards "question"/"menu" (ver
 * ChatbotEngineService.scheduleTimeoutIfConfigured) — um job atrasado por
 * execução. `jobId` fixo por execução garante que agendar um novo timeout
 * (ex.: o cliente respondeu e o fluxo avançou para outra pergunta com
 * timeout configurado) sempre substitui o anterior, nunca acumula.
 */
@Injectable()
export class ChatbotTimeoutProducer {
  constructor(@InjectQueue("chatbot-timeouts") private readonly queue: Queue) {}

  async schedule(executionId: string, nodeId: string, targetNodeId: string, delayMs: number): Promise<void> {
    await this.cancel(executionId);
    await this.queue.add(
      "node_timeout",
      { executionId, nodeId, targetNodeId } satisfies ChatbotTimeoutJobData,
      { jobId: `chatbot-timeout-${executionId}`, delay: delayMs, removeOnComplete: true, removeOnFail: true },
    );
  }

  async cancel(executionId: string): Promise<void> {
    const job = await this.queue.getJob(`chatbot-timeout-${executionId}`);
    if (job) {
      await job.remove();
    }
  }
}
