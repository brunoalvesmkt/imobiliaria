import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { tenantContextStorage } from "../../common/tenant/tenant-context";
import { ChatbotEngineService } from "./chatbot-engine.service";
import type { ChatbotTimeoutJobData } from "./chatbot-timeout.producer";

/**
 * Consumidor da fila "chatbot-timeouts" — roda no processo da API pelo
 * mesmo motivo do AutomationProcessor (reaproveita ChatbotEngineService já
 * instanciado aqui). Idempotência: só age se a execução ainda estiver
 * "running" no MESMO card em que o timeout foi agendado — se o cliente já
 * respondeu (ou o fluxo já avançou por outro caminho), o job é descartado
 * silenciosamente.
 */
@Processor("chatbot-timeouts")
export class ChatbotTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatbotTimeoutProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbotEngine: ChatbotEngineService,
  ) {
    super();
  }

  async process(job: Job<ChatbotTimeoutJobData>): Promise<void> {
    const execution = await this.prisma.chatbotExecution.findUnique({ where: { id: job.data.executionId } });
    if (!execution || execution.status !== "running" || execution.currentNodeId !== job.data.nodeId) {
      return; // já respondido, ou o fluxo já saiu deste card por outro caminho
    }

    await tenantContextStorage.run(
      { tenantId: execution.tenantId, actor: { actorId: "system:chatbot-timeout", actorType: "tenant_user" } },
      async () => {
        try {
          await this.chatbotEngine.triggerTimeout(execution);
        } catch (err) {
          this.logger.error(`Falha ao processar timeout da execução ${execution.id}: ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      },
    );
  }
}
