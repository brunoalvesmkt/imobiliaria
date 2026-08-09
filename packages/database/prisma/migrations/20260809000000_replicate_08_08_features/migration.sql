
-- AlterTable
ALTER TABLE "files" ADD COLUMN     "modulo" TEXT DEFAULT 'outros';

-- AlterTable
ALTER TABLE "notification_templates" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "observacaoFechamento" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "storageLimitMb" INTEGER,
ADD COLUMN     "storageUnlimited" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tenant_storage_usage" (
    "tenantId" TEXT NOT NULL,
    "totalBytes" BIGINT NOT NULL DEFAULT 0,
    "imagensVideosBytes" BIGINT NOT NULL DEFAULT 0,
    "audiosBytes" BIGINT NOT NULL DEFAULT 0,
    "documentosBytes" BIGINT NOT NULL DEFAULT 0,
    "outrosBytes" BIGINT NOT NULL DEFAULT 0,
    "lastNotifiedTier" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_storage_usage_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "opportunity_reasons" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "obrigatorioObservacao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "opportunity_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricaoCurta" TEXT,
    "preco" DECIMAL(12,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "productId" TEXT,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(12,2) NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_checklist_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "obrigatorioMotivo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stage_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_checklist_fills" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "preenchidoPor" TEXT,
    "itens" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_stage_checklist_fills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_checklist_progress" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "resultado" TEXT,
    "motivo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_checklist_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunity_reasons_tenantId_tipo_idx" ON "opportunity_reasons"("tenantId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_reasons_tenantId_tipo_nome_key" ON "opportunity_reasons"("tenantId", "tipo", "nome");

-- CreateIndex
CREATE INDEX "products_tenantId_tipo_idx" ON "products"("tenantId", "tipo");

-- CreateIndex
CREATE INDEX "opportunity_items_tenantId_idx" ON "opportunity_items"("tenantId");

-- CreateIndex
CREATE INDEX "opportunity_items_opportunityId_idx" ON "opportunity_items"("opportunityId");

-- CreateIndex
CREATE INDEX "stage_checklist_items_tenantId_idx" ON "stage_checklist_items"("tenantId");

-- CreateIndex
CREATE INDEX "stage_checklist_items_stageId_idx" ON "stage_checklist_items"("stageId");

-- CreateIndex
CREATE INDEX "opportunity_stage_checklist_fills_tenantId_idx" ON "opportunity_stage_checklist_fills"("tenantId");

-- CreateIndex
CREATE INDEX "opportunity_stage_checklist_fills_opportunityId_idx" ON "opportunity_stage_checklist_fills"("opportunityId");

-- CreateIndex
CREATE INDEX "opportunity_checklist_progress_tenantId_idx" ON "opportunity_checklist_progress"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_checklist_progress_opportunityId_itemId_key" ON "opportunity_checklist_progress"("opportunityId", "itemId");

-- AddForeignKey
ALTER TABLE "tenant_storage_usage" ADD CONSTRAINT "tenant_storage_usage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_reasons" ADD CONSTRAINT "opportunity_reasons_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_items" ADD CONSTRAINT "opportunity_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_items" ADD CONSTRAINT "opportunity_items_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_items" ADD CONSTRAINT "opportunity_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_checklist_items" ADD CONSTRAINT "stage_checklist_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_checklist_items" ADD CONSTRAINT "stage_checklist_items_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "funnel_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_checklist_fills" ADD CONSTRAINT "opportunity_stage_checklist_fills_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_checklist_fills" ADD CONSTRAINT "opportunity_stage_checklist_fills_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_checklist_progress" ADD CONSTRAINT "opportunity_checklist_progress_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_checklist_progress" ADD CONSTRAINT "opportunity_checklist_progress_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_checklist_progress" ADD CONSTRAINT "opportunity_checklist_progress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "stage_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;


