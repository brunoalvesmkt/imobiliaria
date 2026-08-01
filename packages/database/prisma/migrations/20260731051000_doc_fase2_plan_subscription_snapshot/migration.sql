-- Doc-Fase2 (documento de alterações): estende Plan com o necessário para a
-- tela pública de seleção de plano (preço anual, destaque, ordem, teste,
-- publicação) e Subscription com a "fotografia" das condições contratadas.
--
-- publicoAtivo tem default FALSE de propósito: planos já existentes não
-- devem aparecer de repente na página pública sem o Master revisar e
-- publicar cada um conscientemente.

ALTER TABLE "plans"
    ADD COLUMN "precoAnual" DECIMAL(10,2),
    ADD COLUMN "funcionalidades" JSONB,
    ADD COLUMN "diasTeste" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "publicoAtivo" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "destaque" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subscriptions"
    ADD COLUMN "recorrenciaContratada" TEXT,
    ADD COLUMN "precoContratado" DECIMAL(10,2),
    ADD COLUMN "diasTesteContratado" INTEGER,
    ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- Preenche a fotografia das assinaturas já existentes com os valores atuais
-- do plano contratado, para não deixar dado nulo/inconsistente num registro
-- que já está ativo.
UPDATE "subscriptions" s
SET "recorrenciaContratada" = p."recorrencia",
    "precoContratado" = p."preco"
FROM "plans" p
WHERE s."planId" = p."id";
