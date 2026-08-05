-- CreateTable
CREATE TABLE "dashboard_alert_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "queueWaitMinutes" INTEGER NOT NULL DEFAULT 10,
    "opportunityStagnantDays" INTEGER NOT NULL DEFAULT 5,
    "proposalNoResponseDays" INTEGER NOT NULL DEFAULT 3,
    "taskOverdueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_alert_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_alert_configs_tenantId_key" ON "dashboard_alert_configs"("tenantId");

-- AddForeignKey
ALTER TABLE "dashboard_alert_configs" ADD CONSTRAINT "dashboard_alert_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

