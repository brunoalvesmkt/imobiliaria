import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@chatbot-saas/database";

/**
 * Client Prisma "cru", sem filtro automático de tenant. Uso restrito a
 * operações que legitimamente cruzam tenants (Painel Master administrando
 * `Tenant`, `MasterUser`, ou construção do wrapper de `TenantScopedPrismaService`).
 * Módulos de negócio de tenant devem usar `TenantScopedPrismaService`, nunca este.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
