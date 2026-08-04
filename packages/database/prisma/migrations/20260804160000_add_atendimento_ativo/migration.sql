-- Inativar equipes e filas (Atendimento) sem excluir, mesmo padrão já usado em Contact.ativo.
ALTER TABLE "teams" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "queues" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
