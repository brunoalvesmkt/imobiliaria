-- Rastro de sessões de acesso assistido em andamento (Fase 29, ver DEVELOPMENT_PLAN.md).
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "masterUserId" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "impersonation_sessions_tenantId_endedAt_expiresAt_idx" ON "impersonation_sessions"("tenantId", "endedAt", "expiresAt");

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "master_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
