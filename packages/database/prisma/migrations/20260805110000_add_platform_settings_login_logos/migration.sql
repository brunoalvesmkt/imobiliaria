-- Logotipo específico da tela de login (empresa e Master), distinto do logotipo do menu lateral.
ALTER TABLE "platform_settings" ADD COLUMN "tenantLoginLogoLightUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "tenantLoginLogoDarkUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "tenantLoginLogoSizePercent" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "platform_settings" ADD COLUMN "masterLoginLogoLightUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "masterLoginLogoDarkUrl" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "masterLoginLogoSizePercent" INTEGER NOT NULL DEFAULT 100;
