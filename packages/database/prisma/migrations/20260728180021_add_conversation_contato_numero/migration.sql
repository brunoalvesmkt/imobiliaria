/*
  Warnings:

  - Added the required column `contatoNumero` to the `conversations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "contatoNumero" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "conversations_tenantId_whatsAppNumberId_contatoNumero_idx" ON "conversations"("tenantId", "whatsAppNumberId", "contatoNumero");
