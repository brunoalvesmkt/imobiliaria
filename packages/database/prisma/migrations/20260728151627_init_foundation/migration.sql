-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "MasterRole" AS ENUM ('super_admin', 'financeiro', 'suporte');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('view', 'create', 'edit', 'delete', 'send', 'transfer', 'publish', 'approve', 'export', 'administer');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('master', 'tenant_user');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "endereco" TEXT,
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT NOT NULL,
    "logoUrl" TEXT,
    "subdominio" TEXT NOT NULL,
    "dominioCustom" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'trial',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "MasterRole" NOT NULL DEFAULT 'suporte',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "invitedBy" TEXT,
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "scope" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tenantId" TEXT,
    "tenantUserId" TEXT,
    "masterUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tenantUserId" TEXT,
    "masterUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "config" JSONB,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "onBehalfOfTenantId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_cnpj_key" ON "tenants"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdominio_key" ON "tenants"("subdominio");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_dominioCustom_key" ON "tenants"("dominioCustom");

-- CreateIndex
CREATE UNIQUE INDEX "master_users_email_key" ON "master_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_users_email_key" ON "tenant_users"("email");

-- CreateIndex
CREATE INDEX "tenant_users_tenantId_status_idx" ON "tenant_users"("tenantId", "status");

-- CreateIndex
CREATE INDEX "roles_tenantId_idx" ON "roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_nome_key" ON "roles"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "permissions_roleId_idx" ON "permissions"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_roleId_module_action_scope_key" ON "permissions"("roleId", "module", "action", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_tenantUserId_idx" ON "refresh_tokens"("tenantUserId");

-- CreateIndex
CREATE INDEX "refresh_tokens_masterUserId_idx" ON "refresh_tokens"("masterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_tenantUserId_idx" ON "password_reset_tokens"("tenantUserId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_masterUserId_idx" ON "password_reset_tokens"("masterUserId");

-- CreateIndex
CREATE INDEX "feature_flags_tenantId_idx" ON "feature_flags"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_tenantId_module_key" ON "feature_flags"("tenantId", "module");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entity_timestamp_idx" ON "audit_logs"("tenantId", "entity", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_masterUserId_fkey" FOREIGN KEY ("masterUserId") REFERENCES "master_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
