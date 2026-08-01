-- Doc-Fase8: múltiplos telefones + origem configurável do contato
-- (documento de alterações, itens 10.1 e 10.2/11.1).

CREATE TABLE "contact_origins" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contact_origins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_origins_tenantId_nome_key" ON "contact_origins"("tenantId", "nome");

ALTER TABLE "contact_origins" ADD CONSTRAINT "contact_origins_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "contact_phones" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contact_phones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_phones_contactId_numero_key" ON "contact_phones"("contactId", "numero");
CREATE INDEX "contact_phones_contactId_idx" ON "contact_phones"("contactId");

ALTER TABLE "contact_phones" ADD CONSTRAINT "contact_phones_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contacts" ADD COLUMN "origemId" TEXT;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_origemId_fkey"
    FOREIGN KEY ("origemId") REFERENCES "contact_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserva dados existentes: um ContactOrigin por valor distinto de
-- `contacts.origem` já usado em cada tenant, depois vincula `origemId` —
-- nenhum contato existente perde a informação de origem.
INSERT INTO "contact_origins" ("id", "tenantId", "nome", "ativo", "ordem")
SELECT gen_random_uuid(), t."tenantId", t."origem", true, 0
FROM (SELECT DISTINCT "tenantId", "origem" FROM "contacts" WHERE "origem" IS NOT NULL AND "origem" <> '') t;

UPDATE "contacts" c
SET "origemId" = co."id"
FROM "contact_origins" co
WHERE co."tenantId" = c."tenantId" AND co."nome" = c."origem" AND c."origem" IS NOT NULL;
