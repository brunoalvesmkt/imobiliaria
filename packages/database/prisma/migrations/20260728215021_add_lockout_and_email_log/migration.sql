-- AlterTable
ALTER TABLE "master_users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "to" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_tenantId_template_idx" ON "email_logs"("tenantId", "template");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
