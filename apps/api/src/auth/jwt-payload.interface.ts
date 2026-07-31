export interface ImpersonationClaim {
  masterUserId: string;
  accessLevel: "read" | "read_write";
}

export interface TenantAccessTokenPayload {
  type: "tenant";
  sub: string; // TenantUser.id (ou MasterUser.id quando `impersonation` está presente)
  tenantId: string;
  roleId: string;
  /** Presente apenas em tokens emitidos por acesso assistido (ver PERMISSIONS_MATRIX.md §7). */
  impersonation?: ImpersonationClaim;
}

export interface MasterAccessTokenPayload {
  type: "master";
  sub: string; // MasterUser.id
  role: string;
}

/** Fase 32 — login de autoatendimento do afiliado (só leitura das próprias indicações/comissões). */
export interface AffiliateAccessTokenPayload {
  type: "affiliate";
  sub: string; // Affiliate.id
}

export type AccessTokenPayload = TenantAccessTokenPayload | MasterAccessTokenPayload | AffiliateAccessTokenPayload;

export interface AuthenticatedRequestUser {
  type: "tenant" | "master" | "affiliate";
  id: string;
  tenantId?: string;
  roleId?: string;
  masterRole?: string;
  impersonation?: ImpersonationClaim;
}
