-- Doc-Fase6: configurações globais do fluxo de contratação/cadastro,
-- editáveis pelo Master (documento de alterações, seção 5). Linha única.
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "planSelectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowMonthly" BOOLEAN NOT NULL DEFAULT true,
    "allowAnnual" BOOLEAN NOT NULL DEFAULT true,
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "showTrialPeriod" BOOLEAN NOT NULL DEFAULT true,
    "subscribeButtonText" TEXT NOT NULL DEFAULT 'Selecionar plano',
    "allowPlanChangeBeforeSignup" BOOLEAN NOT NULL DEFAULT true,
    "emailConfirmRepeatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailConfirmCodeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tenantCanEditProfile" BOOLEAN NOT NULL DEFAULT true,
    "requireCodeOnEmailChange" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_settings" ("id", "updatedAt") VALUES ('singleton', now());
