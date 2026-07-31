import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { PasswordResetEmailJobData, TenantUserWelcomeJobData } from "@chatbot-saas/types";
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

  async process(job: Job<TenantUserWelcomeJobData | PasswordResetEmailJobData, unknown, string>): Promise<void> {
    if (job.name === "tenant_user.welcome") {
      await this.processWelcome(job.data as TenantUserWelcomeJobData);
      return;
    }
    if (job.name === "tenant_user.password_reset") {
      await this.processPasswordReset(job.data as PasswordResetEmailJobData);
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
}
