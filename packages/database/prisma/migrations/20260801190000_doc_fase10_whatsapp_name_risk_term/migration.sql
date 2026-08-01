-- Doc-Fase10: apelido da conexão de WhatsApp (item 14.1) e termo de risco
-- versionado pelo Master (item 14.3).

ALTER TABLE "whatsapp_numbers" ADD COLUMN "nome" TEXT;

ALTER TABLE "platform_settings" ADD COLUMN "riskTermVersion" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "platform_settings" ADD COLUMN "riskTermText" TEXT NOT NULL DEFAULT 'Ao conectar um número não oficial, você reconhece que este método não é suportado oficialmente pela Meta e pode resultar em bloqueio do número.';
