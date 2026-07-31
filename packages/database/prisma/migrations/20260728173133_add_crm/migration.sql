-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('open', 'won', 'lost');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT,
    "cpf" TEXT,
    "cnpj" TEXT,
    "razaoSocial" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "origem" TEXT,
    "campanha" TEXT,
    "produto" TEXT,
    "servico" TEXT,
    "responsavelId" TEXT,
    "observacoes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deduplication_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "prioridade" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deduplication_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_stages" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "cor" TEXT,
    "probabilidade" INTEGER,
    "camposObrigatorios" JSONB,
    "slaHoras" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "funnel_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "valor" DECIMAL(12,2),
    "probabilidade" INTEGER,
    "produto" TEXT,
    "servico" TEXT,
    "responsavelId" TEXT,
    "previsaoFechamento" TIMESTAMP(3),
    "origem" TEXT,
    "campanha" TEXT,
    "motivoGanho" TEXT,
    "motivoPerda" TEXT,
    "observacoes" TEXT,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "responsavelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "concluidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_tenantId_deletedAt_idx" ON "contacts"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "contacts_tenantId_whatsapp_idx" ON "contacts"("tenantId", "whatsapp");

-- CreateIndex
CREATE INDEX "contacts_tenantId_email_idx" ON "contacts"("tenantId", "email");

-- CreateIndex
CREATE INDEX "contacts_tenantId_cpf_idx" ON "contacts"("tenantId", "cpf");

-- CreateIndex
CREATE INDEX "contacts_tenantId_cnpj_idx" ON "contacts"("tenantId", "cnpj");

-- CreateIndex
CREATE INDEX "deduplication_rules_tenantId_idx" ON "deduplication_rules"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "deduplication_rules_tenantId_campo_key" ON "deduplication_rules"("tenantId", "campo");

-- CreateIndex
CREATE INDEX "funnels_tenantId_idx" ON "funnels"("tenantId");

-- CreateIndex
CREATE INDEX "funnel_stages_funnelId_idx" ON "funnel_stages"("funnelId");

-- CreateIndex
CREATE INDEX "opportunities_tenantId_status_idx" ON "opportunities"("tenantId", "status");

-- CreateIndex
CREATE INDEX "opportunities_funnelId_stageId_idx" ON "opportunities"("funnelId", "stageId");

-- CreateIndex
CREATE INDEX "opportunities_contactId_idx" ON "opportunities"("contactId");

-- CreateIndex
CREATE INDEX "crm_tasks_tenantId_status_idx" ON "crm_tasks"("tenantId", "status");

-- CreateIndex
CREATE INDEX "crm_tasks_contactId_idx" ON "crm_tasks"("contactId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_stages" ADD CONSTRAINT "funnel_stages_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "funnels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "funnel_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "tenant_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
