-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "queueId" TEXT;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "tenantUserId" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'agent',

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "teamId" TEXT,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "distribuicao" TEXT NOT NULL DEFAULT 'least_volume',
    "slaMinutos" INTEGER,
    "mensagemEspera" TEXT,
    "mensagemForaExpediente" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "escopo" TEXT NOT NULL,
    "queueId" TEXT,
    "diaSemana" INTEGER,
    "horaInicio" TEXT,
    "horaFim" TEXT,
    "feriadoData" TIMESTAMP(3),

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_tenantId_idx" ON "teams"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tenantId_nome_key" ON "teams"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "team_members_tenantUserId_idx" ON "team_members"("tenantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_tenantUserId_key" ON "team_members"("teamId", "tenantUserId");

-- CreateIndex
CREATE INDEX "queues_tenantId_idx" ON "queues"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "queues_tenantId_nome_key" ON "queues"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "business_hours_tenantId_escopo_idx" ON "business_hours"("tenantId", "escopo");

-- CreateIndex
CREATE INDEX "conversation_events_tenantId_conversationId_createdAt_idx" ON "conversation_events"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_tenantId_queueId_status_idx" ON "conversations"("tenantId", "queueId", "status");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queues" ADD CONSTRAINT "queues_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
