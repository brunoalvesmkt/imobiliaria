-- Inativar contato (distinto de excluir/anonimizar) — CRM > Contatos.
ALTER TABLE "contacts" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
