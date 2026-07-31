-- Reordenação manual dentro da coluna do Kanban (Fase 27, ver DEVELOPMENT_PLAN.md).
ALTER TABLE "opportunities" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;
