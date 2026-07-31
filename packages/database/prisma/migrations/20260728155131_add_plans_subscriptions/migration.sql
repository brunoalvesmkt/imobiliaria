-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('waiting', 'active', 'overdue', 'delinquent', 'suspended', 'cancelled', 'refunded');

-- AlterEnum
ALTER TYPE "TenantStatus" ADD VALUE 'blocked';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "preco" DECIMAL(10,2) NOT NULL,
    "recorrencia" TEXT NOT NULL DEFAULT 'mensal',
    "modulos" JSONB NOT NULL,
    "limites" JSONB NOT NULL,
    "iaIncluida" BOOLEAN NOT NULL DEFAULT false,
    "apiOficial" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'waiting',
    "startedAt" TIMESTAMP(3),
    "renewedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_nome_key" ON "plans"("nome");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
