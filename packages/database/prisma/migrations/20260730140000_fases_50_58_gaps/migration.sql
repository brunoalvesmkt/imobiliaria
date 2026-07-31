-- AlterEnum
ALTER TYPE "PermissionAction" ADD VALUE 'view_sensitive';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "bloqueado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bloqueadoEm" TIMESTAMP(3),
ADD COLUMN     "bloqueadoMotivo" TEXT;

-- AlterTable
ALTER TABLE "knowledge_base_items" ADD COLUMN     "palavraChave" TEXT,
ADD COLUMN     "prioridade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variacoes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "quick_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "categoria" TEXT,
    "atalho" TEXT,
    "teamId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "opcoes" JSONB,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_messages_tenantId_categoria_ativo_idx" ON "quick_messages"("tenantId", "categoria", "ativo");

-- CreateIndex
CREATE INDEX "custom_field_definitions_tenantId_ativo_ordem_idx" ON "custom_field_definitions"("tenantId", "ativo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_tenantId_chave_key" ON "custom_field_definitions"("tenantId", "chave");

-- AddForeignKey
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "conversation_evaluations_tenantId_conversationId_createdA_idx" RENAME TO "conversation_evaluations_tenantId_conversationId_createdAt_idx";

