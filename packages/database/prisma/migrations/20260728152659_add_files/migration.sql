-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_bucketKey_key" ON "files"("bucketKey");

-- CreateIndex
CREATE INDEX "files_tenantId_idx" ON "files"("tenantId");
