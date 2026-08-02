-- Personalização de logotipo (painel das empresas e painel Master), com
-- logos separados para modo claro/escuro e um percentual de tamanho.
ALTER TABLE "platform_settings" ADD COLUMN "tenantLogoLightUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "tenantLogoDarkUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "tenantLogoSizePercent" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "platform_settings" ADD COLUMN "masterLogoLightUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "masterLogoDarkUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "masterLogoSizePercent" INTEGER NOT NULL DEFAULT 100;
