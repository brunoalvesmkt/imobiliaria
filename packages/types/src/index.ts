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

export interface EmailConfirmationCodeJobData {
  tenantId: string;
  tenantUserId: string;
  email: string;
  codigo: string;
}
