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
  /**
   * `false` quando a confirmação de e-mail por código está ativa
   * (PlatformSettings.emailConfirmCodeEnabled) e o tenant ainda não
   * confirmou (documento de alterações, seção 4) — `TenantAuthGuard` usa
   * isso para bloquear o painel até a confirmação. Omitido (equivalente a
   * confirmado) no caso comum, para não inflar todo token existente.
   */
  emailConfirmed?: boolean;
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
  emailConfirmed?: boolean;
}
