-- Fase 32: login de autoatendimento do afiliado gera auditoria própria.
ALTER TYPE "AuditActorType" ADD VALUE IF NOT EXISTS 'affiliate';
