ALTER TABLE "automations" ADD COLUMN "cooldownMinutos" INTEGER;

ALTER TABLE "automation_executions" ADD COLUMN "dadosGatilho" JSONB;
ALTER TABLE "automation_executions" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "automation_executions" ADD COLUMN "chainDepth" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "follow_up_schedules" ADD COLUMN "dadosGatilho" JSONB;
