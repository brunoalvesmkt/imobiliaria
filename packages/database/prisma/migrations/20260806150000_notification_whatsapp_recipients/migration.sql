CREATE TABLE "notification_whatsapp_recipients" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT,
    "numero" TEXT NOT NULL,
    "tipos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_whatsapp_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_whatsapp_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_whatsapp_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_whatsapp_recipients_tenantId_idx" ON "notification_whatsapp_recipients"("tenantId");

CREATE INDEX "notification_whatsapp_deliveries_tenantId_recipientId_createdAt_idx" ON "notification_whatsapp_deliveries"("tenantId", "recipientId", "createdAt");

ALTER TABLE "notification_whatsapp_recipients" ADD CONSTRAINT "notification_whatsapp_recipients_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_whatsapp_deliveries" ADD CONSTRAINT "notification_whatsapp_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_whatsapp_deliveries" ADD CONSTRAINT "notification_whatsapp_deliveries_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "notification_whatsapp_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
