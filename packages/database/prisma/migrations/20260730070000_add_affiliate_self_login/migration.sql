-- Login próprio do afiliado (Fase 32, ver DEVELOPMENT_PLAN.md).
ALTER TABLE "affiliates" ADD COLUMN "passwordHash" TEXT;

ALTER TABLE "refresh_tokens" ADD COLUMN "affiliateId" TEXT;

CREATE INDEX "refresh_tokens_affiliateId_idx" ON "refresh_tokens"("affiliateId");

ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
