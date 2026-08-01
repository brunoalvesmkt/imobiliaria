-- CreateTable
CREATE TABLE "crm_task_types" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "crm_task_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_task_types_tenantId_nome_key" ON "crm_task_types"("tenantId", "nome");

-- AddForeignKey
ALTER TABLE "crm_task_types" ADD CONSTRAINT "crm_task_types_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
