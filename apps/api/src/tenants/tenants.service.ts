import { BadRequestException, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationsProducer } from "../queues/notifications.producer";
import { hashOpaqueToken } from "../auth/crypto.util";

const CODE_TTL_MS = 15 * 60 * 1000;

/**
 * Troca do e-mail da empresa (Tenant.email, diferente do e-mail de login do
 * usuário) com confirmação por código de 6 dígitos — documento de
 * alterações da plataforma, item 6.1.7.3. O requisito é "configurável": com
 * `EMAIL_CONFIRMATION_REQUIRED=false` a troca aplica na hora (sem código),
 * do contrário (padrão) fica pendente em `emailPendente*` até o código ser
 * confirmado, sem afetar o e-mail atualmente em uso.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsProducer,
  ) {}

  private get confirmationRequired(): boolean {
    return process.env.EMAIL_CONFIRMATION_REQUIRED !== "false";
  }

  async requestEmailChange(tenantId: string, actorUserId: string, novoEmail: string): Promise<{ status: "ok"; requiresConfirmation: boolean }> {
    if (!this.confirmationRequired) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { email: novoEmail, emailPendente: null, emailPendenteCodigo: null, emailPendenteExpira: null, emailConfirmado: true },
      });
      await this.audit.record({ actorId: actorUserId, actorType: "tenant_user", action: "tenant.email_changed", entity: "Tenant", entityId: tenantId });
      return { status: "ok", requiresConfirmation: false };
    }

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        emailPendente: novoEmail,
        emailPendenteCodigo: hashOpaqueToken(codigo),
        emailPendenteExpira: new Date(Date.now() + CODE_TTL_MS),
        emailConfirmado: false,
      },
    });

    await this.notifications.enqueueEmailConfirmationCode({ tenantId, tenantUserId: actorUserId, email: novoEmail, codigo });
    await this.audit.record({ actorId: actorUserId, actorType: "tenant_user", action: "tenant.email_change_requested", entity: "Tenant", entityId: tenantId });

    return { status: "ok", requiresConfirmation: true };
  }

  async confirmEmailChange(tenantId: string, actorUserId: string, codigo: string): Promise<{ status: "ok" }> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    if (!tenant.emailPendente || !tenant.emailPendenteCodigo || !tenant.emailPendenteExpira) {
      throw new BadRequestException("Não há troca de e-mail pendente para confirmar.");
    }
    if (tenant.emailPendenteExpira < new Date()) {
      throw new BadRequestException("Código expirado — solicite a troca de e-mail novamente.");
    }
    if (tenant.emailPendenteCodigo !== hashOpaqueToken(codigo)) {
      throw new BadRequestException("Código inválido.");
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        email: tenant.emailPendente,
        emailPendente: null,
        emailPendenteCodigo: null,
        emailPendenteExpira: null,
        emailConfirmado: true,
      },
    });

    await this.audit.record({ actorId: actorUserId, actorType: "tenant_user", action: "tenant.email_confirmed", entity: "Tenant", entityId: tenantId });

    return { status: "ok" };
  }
}
