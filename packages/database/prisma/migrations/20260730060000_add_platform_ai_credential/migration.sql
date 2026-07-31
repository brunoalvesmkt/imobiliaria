-- Chave de IA da própria plataforma configurável pelo Master (Fase 30, ver DEVELOPMENT_PLAN.md).
CREATE TABLE "platform_ai_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ai_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_ai_credentials_provider_key" ON "platform_ai_credentials"("provider");
