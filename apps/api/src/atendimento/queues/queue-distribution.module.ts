import { Module } from "@nestjs/common";
import { QueueDistributionService } from "./queue-distribution.service";

/**
 * Módulo próprio e sem dependências de propósito — mesmo motivo do
 * `LeadScoreConfigModule`: `ChatbotEngineService` precisa desta lógica
 * (transferência com distribuição automática), e importar `AtendimentoModule`
 * direto em `ChatbotModule` arriscaria um ciclo.
 */
@Module({
  providers: [QueueDistributionService],
  exports: [QueueDistributionService],
})
export class QueueDistributionModule {}
