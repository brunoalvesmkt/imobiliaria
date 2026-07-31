import { Module } from "@nestjs/common";
import { LeadScoreConfigService } from "./lead-score-config.service";

/**
 * Módulo próprio e sem dependências de `CrmModule`/`ChatbotModule` de
 * propósito: `ChatbotEngineService` (Fase 42) precisa ler os limiares de
 * Lead Score do tenant, mas `ChatbotModule` já é importado por
 * `AutomationModule`, que por sua vez é importado por `CrmModule` —
 * importar `CrmModule` direto em `ChatbotModule` criaria um ciclo.
 */
@Module({
  providers: [LeadScoreConfigService],
  exports: [LeadScoreConfigService],
})
export class LeadScoreConfigModule {}
