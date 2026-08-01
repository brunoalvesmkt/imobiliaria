import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type {
  EmailConfirmationCodeJobData,
  PasswordResetEmailJobData,
  TenantUserWelcomeJobData,
  TwoFactorLoginCodeJobData,
} from "@chatbot-saas/types";
import { PrismaService } from "../prisma/prisma.service";
import { LogEmailProvider } from "../notifications/log-email.provider";

/**
 * Consumidor da fila "notifications" — produção na API (`NotificationsProducer`),
 * processamento aqui. Cada e-mail "enviado" (via `EmailProvider`, hoje o
 * simulador `LogEmailProvider` — ver DEVELOPMENT_PLAN.md Fase 10) gera um
 * `EmailLog` real e consultável, fechando o débito técnico registrado na
 * Fase 1 ("envio real de e-mail fica para quando o módulo de Notifications
 * existir").
 */
@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: LogEmailProvider,
  ) {
    super();
  }

  async process(
    job: Job<TenantUserWelcomeJobData | PasswordResetEmailJobData | EmailConfirmationCodeJobData | TwoFactorLoginCodeJobData, unknown, string>,
  ): Promise<void> {
    if (job.name === "tenant_user.welcome") {
      await this.processWelcome(job.data as TenantUserWelcomeJobData);
      return;
    }
    if (job.name === "tenant_user.password_reset") {
      await this.processPasswordReset(job.data as PasswordResetEmailJobData);
      return;
    }
    if (job.name === "tenant.email_confirmation_code") {
      await this.processEmailConfirmationCode(job.data as EmailConfirmationCodeJobData);
      return;
    }
    if (job.name === "tenant_user.two_factor_code") {
      await this.processTwoFactorCode(job.data as TwoFactorLoginCodeJobData);
      return;
    }
  }

  private async processWelcome(data: TenantUserWelcomeJobData): Promise<void> {
    const { tenantId, tenantUserId, email } = data;
    this.logger.log(`Processando boas-vindas para ${email} (tenant ${tenantId})`);

    const result = await this.emailProvider.send({
      to: email,
      assunto: "Bem-vindo(a) à plataforma",
      corpo: "Sua conta foi criada com sucesso. Acesse o painel para começar a configurar sua empresa.",
      template: "welcome",
    });

    await this.prisma.$transaction([
      this.prisma.emailLog.create({
        data: { tenantId, to: email, assunto: "Bem-vindo(a) à plataforma", template: "welcome", provider: this.emailProvider.name, providerRef: result.providerRef },
      }),
      this.prisma.auditLog.create({
        data: { tenantId, actorId: tenantUserId, actorType: "tenant_user", action: "notification.welcome_sent", entity: "TenantUser", entityId: tenantUserId },
      }),
    ]);
  }

  private async processPasswordReset(data: PasswordResetEmailJobData): Promise<void> {
    const { tenantId, tenantUserId, email, rawToken } = data;
    this.logger.log(`Processando e-mail de recuperação de senha para ${email} (tenant ${tenantId})`);

    const result = await this.emailProvider.send({
      to: email,
      assunto: "Recuperação de senha",
      corpo: `Use o token a seguir para redefinir sua senha (válido por 1 hora): ${rawToken}`,
      template: "password_reset",
    });

    await this.prisma.$transaction([
      this.prisma.emailLog.create({
        data: { tenantId, to: email, assunto: "Recuperação de senha", template: "password_reset", provider: this.emailProvider.name, providerRef: result.providerRef },
      }),
      this.prisma.auditLog.create({
        data: { tenantId, actorId: tenantUserId, actorType: "tenant_user", action: "notification.password_reset_sent", entity: "TenantUser", entityId: tenantUserId },
      }),
    ]);
  }

  private async processEmailConfirmationCode(data: EmailConfirmationCodeJobData): Promise<void> {
    const { tenantId, tenantUserId, email, codigo } = data;
    this.logger.log(`Processando código de confirmação de e-mail para ${email} (tenant ${tenantId})`);

    const result = await this.emailProvider.send({
      to: email,
      assunto: "Confirme seu novo e-mail",
      corpo: `Use o código a seguir para confirmar este e-mail (válido por 15 minutos): ${codigo}`,
      template: "email_confirmation_code",
    });

    await this.prisma.$transaction([
      this.prisma.emailLog.create({
        data: {
          tenantId,
          to: email,
          assunto: "Confirme seu novo e-mail",
          template: "email_confirmation_code",
          provider: this.emailProvider.name,
          providerRef: result.providerRef,
        },
      }),
      this.prisma.auditLog.create({
        data: { tenantId, actorId: tenantUserId, actorType: "tenant_user", action: "notification.email_confirmation_code_sent", entity: "TenantUser", entityId: tenantUserId },
      }),
    ]);
  }

  private async processTwoFactorCode(data: TwoFactorLoginCodeJobData): Promise<void> {
    const { tenantId, tenantUserId, email, codigo } = data;
    this.logger.log(`Processando código de verificação em duas etapas para ${email} (tenant ${tenantId})`);

    const result = await this.emailProvider.send({
      to: email,
      assunto: "Código de verificação de login",
      corpo: `Use o código a seguir para concluir seu login (válido por 10 minutos): ${codigo}`,
      template: "two_factor_code",
    });

    await this.prisma.$transaction([
      this.prisma.emailLog.create({
        data: {
          tenantId,
          to: email,
          assunto: "Código de verificação de login",
          template: "two_factor_code",
          provider: this.emailProvider.name,
          providerRef: result.providerRef,
        },
      }),
      this.prisma.auditLog.create({
        data: { tenantId, actorId: tenantUserId, actorType: "tenant_user", action: "notification.two_factor_code_sent", entity: "TenantUser", entityId: tenantUserId },
      }),
    ]);
  }
}
