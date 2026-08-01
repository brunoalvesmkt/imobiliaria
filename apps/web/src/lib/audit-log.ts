import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

export interface AuditLogEntry {
  id: string;
  tenantId: string | null;
  actorId: string;
  actorType: "tenant_user" | "master" | "system";
  onBehalfOfTenantId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  timestamp: string;
}

export interface AuditLogFilter {
  entity?: string | undefined;
  action?: string | undefined;
  actorId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

function toQueryString(filter: AuditLogFilter & { tenantId?: string | undefined }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAuditLog(filter: AuditLogFilter) {
  return useQuery({
    queryKey: ["audit-log", filter],
    queryFn: () => apiGet<AuditLogEntry[]>(`/audit-log${toQueryString(filter)}`),
  });
}

export function useMasterAuditLog(filter: AuditLogFilter & { tenantId?: string | undefined }) {
  return useQuery({
    queryKey: ["master-audit-log", filter],
    queryFn: () => apiGet<AuditLogEntry[]>(`/master/audit-log${toQueryString(filter)}`),
  });
}
