export interface TenantUserWelcomeJobData {
  tenantId: string;
  tenantUserId: string;
  email: string;
}

export interface PasswordResetEmailJobData {
  tenantId: string;
  tenantUserId: string;
  email: string;
  rawToken: string;
}
