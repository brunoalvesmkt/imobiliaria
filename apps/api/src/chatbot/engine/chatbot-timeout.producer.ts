import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";

export interface ChatbotTimeoutJobData {
  executionId: string;
  nodeId: string;
}

/**
 * Reativação por falta de resposta dos cards "question"/"menu" (ver
 * ChatbotEngineService.scheduleTimeoutIfConfigured) — um job atrasado por
 * execução. `jobId` fixo por execução garante que agendar um novo timeout
 * (ex.: o cliente respondeu e o fluxo avançou para outra pergunta com
 * timeout configurado) sempre substitui o anterior, nunca acumula. O
 * destino ("Não respondeu"/"Limite atingido") é resolvido pelas conexões do
 * fluxo só na hora do disparo (ChatbotEngineService.triggerTimeout), nunca
 * gravado no job — evita destino desatualizado se o fluxo for republicado.
 */
@Injectable()
export class ChatbotTimeoutProducer {
  constructor(@InjectQueue("chatbot-timeouts") private readonly queue: Queue) {}

  async schedule(executionId: string, nodeId: string, delayMs: number): Promise<void> {
    await this.cancel(executionId);
    await this.queue.add(
      "node_timeout",
      { executionId, nodeId } satisfies ChatbotTimeoutJobData,
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
