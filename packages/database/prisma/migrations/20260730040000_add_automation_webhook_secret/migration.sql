-- Assinatura HMAC para a ação "send_webhook" (Fase 28, ver DEVELOPMENT_PLAN.md).
ALTER TABLE "automations" ADD COLUMN "webhookSecret" TEXT;
