-- CreateTable
CREATE TABLE "conversation_evaluations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "solicitanteId" TEXT NOT NULL,
    "notaGeral" DOUBLE PRECISION NOT NULL,
    "classificacao" TEXT NOT NULL,
    "criteriosAvaliados" JSONB NOT NULL,
    "pontosPositivos" JSONB NOT NULL,
    "pontosMelhoria" JSONB NOT NULL,
    "oportunidadesPerdidas" JSONB NOT NULL,
    "momentosCriticos" JSONB NOT NULL,
    "sugestoes" JSONB NOT NULL,
    "resumoExecutivo" TEXT NOT NULL,
    "modeloUtilizado" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_evaluations_tenantId_conversationId_createdA_idx" ON "conversation_evaluations"("tenantId", "conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "conversation_evaluations" ADD CONSTRAINT "conversation_evaluations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_evaluations" ADD CONSTRAINT "conversation_evaluations_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_evaluations" ADD CONSTRAINT "conversation_evaluations_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "tenant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
