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
 * execução. `jobId` inclui o nº de tentativas já registradas (`attempt`) —
 * NUNCA um id fixo por execução: quando um timeout dispara e reagenda o
 * próximo (self-loop de reativação), isso acontece de DENTRO do próprio
 * processamento do job anterior, que continua "ativo" no BullMQ até essa
 * cadeia terminar. Um `jobId` fixo faria o novo `queue.add()` colidir com o
 * job ainda ativo (o BullMQ ignora silenciosamente um id já existente), e
 * nenhuma reativação seguinte seria de fato agendada — a execução ficava
 * presa esperando para sempre, sem nunca atingir o limite de tentativas.
 * `attempt` sempre difere do job que está processando (é o valor já
 * incrementado), então nunca há colisão.
 */
@Injectable()
export class ChatbotTimeoutProducer {
  constructor(@InjectQueue("chatbot-timeouts") private readonly queue: Queue) {}

  private jobId(executionId: string, nodeId: string, attempt: number): string {
    return `chatbot-timeout-${executionId}-${nodeId}-${attempt}`;
  }

  async schedule(executionId: string, nodeId: string, attempt: number, delayMs: number): Promise<void> {
    await this.queue.add(
      "node_timeout",
      { executionId, nodeId } satisfies ChatbotTimeoutJobData,
      { jobId: this.jobId(executionId, nodeId, attempt), delay: delayMs, removeOnComplete: true, removeOnFail: true },
    );
  }

  async cancel(executionId: string, nodeId: string, attempt: number): Promise<void> {
    const job = await this.queue.getJob(this.jobId(executionId, nodeId, attempt));
    if (job) {
      await job.remove();
    }
  }
}
