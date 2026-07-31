-- AlterTable
ALTER TABLE "whatsapp_numbers" ADD COLUMN     "chatbotFlowId" TEXT;

-- CreateTable
CREATE TABLE "chatbot_flows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "versaoAtual" INTEGER NOT NULL DEFAULT 1,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chatbot_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_flow_versions" (
    "id" TEXT NOT NULL,
    "chatbotFlowId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "definicao" JSONB NOT NULL,
    "publicadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_executions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatbotFlowId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "conversationId" TEXT NOT NULL,
    "contactId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "currentNodeId" TEXT,
    "contextData" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "chatbot_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "arquivoId" TEXT,
    "campanha" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatbot_flows_tenantId_status_idx" ON "chatbot_flows"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_flows_tenantId_nome_key" ON "chatbot_flows"("tenantId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_flow_versions_chatbotFlowId_versao_key" ON "chatbot_flow_versions"("chatbotFlowId", "versao");

-- CreateIndex
CREATE INDEX "chatbot_executions_tenantId_conversationId_status_idx" ON "chatbot_executions"("tenantId", "conversationId", "status");

-- CreateIndex
CREATE INDEX "knowledge_base_items_tenantId_tipo_ativo_idx" ON "knowledge_base_items"("tenantId", "tipo", "ativo");

-- AddForeignKey
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "chatbot_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_flows" ADD CONSTRAINT "chatbot_flows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_flow_versions" ADD CONSTRAINT "chatbot_flow_versions_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "chatbot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_executions" ADD CONSTRAINT "chatbot_executions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_executions" ADD CONSTRAINT "chatbot_executions_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "chatbot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_executions" ADD CONSTRAINT "chatbot_executions_chatbotFlowId_versao_fkey" FOREIGN KEY ("chatbotFlowId", "versao") REFERENCES "chatbot_flow_versions"("chatbotFlowId", "versao") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_executions" ADD CONSTRAINT "chatbot_executions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base_items" ADD CONSTRAINT "knowledge_base_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
