-- Múltiplos e-mails por contato — mesmo padrão de contact_phones.
CREATE TABLE "contact_emails" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "principal" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "contact_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contact_emails_contactId_email_key" ON "contact_emails"("contactId", "email");
CREATE INDEX "contact_emails_contactId_idx" ON "contact_emails"("contactId");

ALTER TABLE "contact_emails" ADD CONSTRAINT "contact_emails_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: contatos já existentes com e-mail preenchido ganham uma linha principal correspondente.
INSERT INTO "contact_emails" ("id", "contactId", "email", "principal")
SELECT gen_random_uuid(), "id", "email", true
FROM "contacts"
WHERE "email" IS NOT NULL AND "email" <> '';
