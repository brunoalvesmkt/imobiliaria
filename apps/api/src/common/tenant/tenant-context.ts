import { AsyncLocalStorage } from "node:async_hooks";
import type { AuditActorType } from "@chatbot-saas/database";

export interface CurrentActor {
  actorId: string;
  actorType: AuditActorType;
  /** Presente apenas durante acesso assistido (impersonação) — ver PERMISSIONS_MATRIX.md §7. */
  onBehalfOfTenantId?: string;
}

export interface TenantContextStore {
  tenantId: string;
  actor: CurrentActor;
}

/**
 * Fonte única de verdade do tenant e do ator (quem está agindo) da
 * requisição atual. Nunca é populado a partir de input do cliente — apenas
 * pelo TenantContextInterceptor, depois que o JWT foi validado (ver
 * SECURITY.md §2). Isso permite que o AuditService atribua corretamente uma
 * ação a um MasterUser em impersonação sem que cada service precise
 * calcular isso manualmente.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextStore>();

export function getCurrentTenantId(): string | undefined {
  return tenantContextStorage.getStore()?.tenantId;
}

export function requireCurrentTenantId(): string {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error(
      "Tentativa de acessar dado multiempresa fora de um contexto de tenant resolvido.",
    );
  }
  return tenantId;
}

export function getCurrentActor(): CurrentActor | undefined {
  return tenantContextStorage.getStore()?.actor;
}
