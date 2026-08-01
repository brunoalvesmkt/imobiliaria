-- Doc-Fase7: verificação em duas etapas por e-mail (documento de alterações, item 8.2).
ALTER TABLE "tenant_users" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
