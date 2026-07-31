-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "gatilhoTipo" TEXT NOT NULL,
    "condicoes" JSONB,
    "acoes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "gatilhoDisparado" TEXT NOT NULL,
    "acoesExecutadas" JSONB,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "erro" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "contactId" TEXT,
    "conversationId" TEXT,
    "sequenciaIndex" INTEGER NOT NULL DEFAULT 0,
    "agendadoPara" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "canceladoPorEvento" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automations_tenantId_gatilhoTipo_status_idx" ON "automations"("tenantId", "gatilhoTipo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "automations_tenantId_nome_key" ON "automations"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "automation_executions_tenantId_automationId_status_idx" ON "automation_executions"("tenantId", "automationId", "status");

-- CreateIndex
CREATE INDEX "follow_up_schedules_tenantId_status_agendadoPara_idx" ON "follow_up_schedules"("tenantId", "status", "agendadoPara");

-- CreateIndex
CREATE INDEX "follow_up_schedules_conversationId_status_idx" ON "follow_up_schedules"("conversationId", "status");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_schedules" ADD CONSTRAINT "follow_up_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_schedules" ADD CONSTRAINT "follow_up_schedules_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
