-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenantId_recipientUserId_readAt_idx" ON "notifications"("tenantId", "recipientUserId", "readAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
