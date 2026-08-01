-- Doc-Fase1 (documento de alterações da plataforma): estende Tenant com
-- endereço completo, segmento (tabela, não enum — preparado para gestão
-- futura pelo Master) e campos de troca de e-mail com confirmação.
--
-- emailConfirmado tem default TRUE de propósito: tenants já existentes (ex.:
-- a empresa cadastrada nesta sessão antes desta fase) não devem ficar
-- retroativamente bloqueados por uma confirmação que não existia quando
-- se cadastraram. Só cadastros novos, feitos com a confirmação por código
-- ativada nas configurações do Master, nascerão com FALSE.

CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "segments_nome_key" ON "segments"("nome");

-- Seed dos três segmentos iniciais pedidos no documento.
INSERT INTO "segments" ("id", "nome", "ativo", "ordem", "updatedAt") VALUES
    (gen_random_uuid()::text, 'Comércio', true, 0, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Indústria', true, 1, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Serviços', true, 2, CURRENT_TIMESTAMP);

ALTER TABLE "tenants"
    ADD COLUMN "numero" TEXT,
    ADD COLUMN "bairro" TEXT,
    ADD COLUMN "cidade" TEXT,
    ADD COLUMN "uf" TEXT,
    ADD COLUMN "cep" TEXT,
    ADD COLUMN "segmentoId" TEXT,
    ADD COLUMN "emailPendente" TEXT,
    ADD COLUMN "emailPendenteCodigo" TEXT,
    ADD COLUMN "emailPendenteExpira" TIMESTAMP(3),
    ADD COLUMN "emailConfirmado" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_segmentoId_fkey"
    FOREIGN KEY ("segmentoId") REFERENCES "segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
