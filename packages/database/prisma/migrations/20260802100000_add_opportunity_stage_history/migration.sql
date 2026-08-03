-- Métricas de tempo de ciclo do funil (Relatórios > CRM): tempo médio por
-- etapa, até a última etapa, até ganha e até perdida.
ALTER TABLE "opportunities" ADD COLUMN "wonAt" TIMESTAMP(3);
ALTER TABLE "opportunities" ADD COLUMN "lostAt" TIMESTAMP(3);

CREATE TABLE "opportunity_stage_history" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "exitedAt" TIMESTAMP(3),

  CONSTRAINT "opportunity_stage_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "opportunity_stage_history_tenantId_idx" ON "opportunity_stage_history"("tenantId");
CREATE INDEX "opportunity_stage_history_opportunityId_idx" ON "opportunity_stage_history"("opportunityId");
CREATE INDEX "opportunity_stage_history_stageId_exitedAt_idx" ON "opportunity_stage_history"("stageId", "exitedAt");

ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opportunity_stage_history" ADD CONSTRAINT "opportunity_stage_history_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "funnel_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: oportunidades já ganhas/perdidas não têm wonAt/lostAt (colunas
-- novas) — usa updatedAt como melhor aproximação disponível do momento do
-- fechamento, para não perder essas oportunidades das novas métricas.
UPDATE "opportunities" SET "wonAt" = "updatedAt" WHERE "status" = 'won' AND "wonAt" IS NULL;
UPDATE "opportunities" SET "lostAt" = "updatedAt" WHERE "status" = 'lost' AND "lostAt" IS NULL;

-- Backfill: para oportunidades já existentes, cria uma linha de histórico
-- "aberta" (sem exitedAt) na etapa atual, ancorada em createdAt — é a melhor
-- aproximação possível sem dados retroativos de transição real.
INSERT INTO "opportunity_stage_history" ("id", "tenantId", "opportunityId", "stageId", "enteredAt", "exitedAt")
SELECT gen_random_uuid(), "tenantId", "id", "stageId", "createdAt", CASE WHEN "status" <> 'open' THEN COALESCE("wonAt", "lostAt", "updatedAt") ELSE NULL END
FROM "opportunities";
