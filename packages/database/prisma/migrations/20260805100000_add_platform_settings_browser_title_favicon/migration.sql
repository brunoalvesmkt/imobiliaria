-- Título da aba do navegador e favicon, configuráveis pelo Master, únicos para toda a plataforma.
ALTER TABLE "platform_settings" ADD COLUMN "browserTitle" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "faviconUrl" TEXT;
