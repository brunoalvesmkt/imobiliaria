-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('pending', 'paid', 'overdue', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('pending', 'approved', 'rejected', 'active', 'inactive', 'blocked');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'pending',
    "vencimento" TIMESTAMP(3) NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "metodo" TEXT,
    "gatewayRef" TEXT,
    "motivoEstorno" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sobrenome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "endereco" TEXT,
    "dadosPagamento" JSONB,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'pending',
    "linkCode" TEXT NOT NULL,
    "aceitoTermosEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "recorrente" BOOLEAN NOT NULL DEFAULT false,
    "planId" TEXT,
    "moduleId" TEXT,
    "prazoLimiteDias" INTEGER,
    "carenciaDias" INTEGER NOT NULL DEFAULT 0,
    "minimoParaPagamento" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_referrals" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "tenantId" TEXT,
    "evento" TEXT NOT NULL,
    "planId" TEXT,
    "valorComissao" DECIMAL(10,2),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "elegivelEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_tenantId_status_idx" ON "invoices"("tenantId", "status");

-- CreateIndex
CREATE INDEX "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_cpf_key" ON "affiliates"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_email_key" ON "affiliates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_linkCode_key" ON "affiliates"("linkCode");

-- CreateIndex
CREATE INDEX "affiliate_commissions_affiliateId_idx" ON "affiliate_commissions"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_referrals_affiliateId_status_idx" ON "affiliate_referrals"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "affiliate_referrals_tenantId_idx" ON "affiliate_referrals"("tenantId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
