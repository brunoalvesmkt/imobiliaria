-- CreateTable
CREATE TABLE "whatsapp_numbers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "provider" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "responsavelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "whatsapp_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "whatsAppNumberId" TEXT,
    "nome" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'pt_BR',
    "categoria" TEXT NOT NULL,
    "cabecalho" TEXT,
    "corpo" TEXT NOT NULL,
    "rodape" TEXT,
    "variaveis" JSONB,
    "botoes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_acceptances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "whatsAppNumberId" TEXT NOT NULL,
    "aceitoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versaoTermo" TEXT NOT NULL,
    "ip" TEXT,
    "recursosAtivados" JSONB,

    CONSTRAINT "risk_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT,
    "whatsAppNumberId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "origem" TEXT,
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'text',
    "conteudo" TEXT,
    "midiaUrl" TEXT,
    "statusEntrega" TEXT NOT NULL DEFAULT 'sent',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_numbers_tenantId_status_idx" ON "whatsapp_numbers"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_numbers_tenantId_numero_key" ON "whatsapp_numbers"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "whatsapp_templates_tenantId_status_idx" ON "whatsapp_templates"("tenantId", "status");

-- CreateIndex
CREATE INDEX "risk_acceptances_whatsAppNumberId_idx" ON "risk_acceptances"("whatsAppNumberId");

-- CreateIndex
CREATE INDEX "conversations_tenantId_status_lastMessageAt_idx" ON "conversations"("tenantId", "status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_externalId_key" ON "messages"("externalId");

-- CreateIndex
CREATE INDEX "messages_tenantId_conversationId_createdAt_idx" ON "messages"("tenantId", "conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_whatsAppNumberId_fkey" FOREIGN KEY ("whatsAppNumberId") REFERENCES "whatsapp_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_acceptances" ADD CONSTRAINT "risk_acceptances_whatsAppNumberId_fkey" FOREIGN KEY ("whatsAppNumberId") REFERENCES "whatsapp_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_whatsAppNumberId_fkey" FOREIGN KEY ("whatsAppNumberId") REFERENCES "whatsapp_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
