-- CreateTable
CREATE TABLE "tenant_ai_credentials" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_ai_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_ai_credentials_tenantId_provider_key" ON "tenant_ai_credentials"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "tenant_ai_credentials" ADD CONSTRAINT "tenant_ai_credentials_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
