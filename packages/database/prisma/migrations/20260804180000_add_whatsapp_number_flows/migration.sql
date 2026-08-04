-- Múltiplos fluxos de chatbot por conexão de WhatsApp, cada um com sua própria regra de
-- ativação (palavra/frase específica ou qualquer mensagem) — substitui o antigo
-- WhatsAppNumber.chatbotFlowId (1 fluxo só), que é mantido apenas para não perder o vínculo de
-- conexões já configuradas antes desta migration.

ALTER TABLE "whatsapp_numbers" ADD COLUMN "interromperFluxoAtual" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "whatsapp_number_flows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "whatsAppNumberId" TEXT NOT NULL,
    "chatbotFlowId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "regraAtivacao" TEXT NOT NULL DEFAULT 'keyword',
    "termos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_number_flows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_number_flows_whatsAppNumberId_chatbotFlowId_key" ON "whatsapp_number_flows"("whatsAppNumberId", "chatbotFlowId");
CREATE INDEX "whatsapp_number_flows_tenantId_whatsAppNumberId_ativo_idx" ON "whatsapp_number_flows"("tenantId", "whatsAppNumberId", "ativo");

ALTER TABLE "whatsapp_number_flows" ADD CONSTRAINT "whatsapp_number_flows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_number_flows" ADD CONSTRAINT "whatsapp_number_flows_whatsAppNumberId_fkey" FOREIGN KEY ("whatsAppNumberId") REFERENCES "whatsapp_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_number_flows" ADD CONSTRAINT "whatsapp_number_flows_chatbotFlowId_fkey" FOREIGN KEY ("chatbotFlowId") REFERENCES "chatbot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
