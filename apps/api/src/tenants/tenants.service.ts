import { BadRequestException, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationsProducer } from "../queues/notifications.producer";
import { PlatformSettingsService } from "../master/settings/platform-settings.service";
import { hashOpaqueToken } from "../auth/crypto.util";

const CODE_TTL_MS = 15 * 60 * 1000;

/**
 * Confirmação de e-mail por código (documento de alterações, seções 4 e
 * 6.1.7.3) — dois usos dos mesmos campos `emailPendente*`:
 *  1. Confirmar o e-mail informado no cadastro (sem `emailPendente`
 *     preenchido — o endereço em si não muda, só o status `emailConfirmado`
 *     — gerado por `AuthService.signupTenant`);
 *  2. Trocar o e-mail em "Meus Dados" (`emailPendente` guarda o novo
 *     endereço até a confirmação, sem afetar o e-mail em uso).
 * `PlatformSettings.requireCodeOnEmailChange` decide se a troca de e-mail
 * (uso 2) exige código ou aplica na hora — configurável pelo Master.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsProducer,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async requestEmailChange(tenantId: string, actorUserId: string, novoEmail: string): Promise<{ status: "ok"; requiresConfirmation: boolean }> {
    const settings = await this.platformSettings.get();

    if (!settings.requireCodeOnEmailChange) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { email: novoEmail, emailPendente: null, emailPendenteCodigo: null, emailPendenteExpira: null, emailConfirmado: true },
      });
      await this.audit.record({ actorId: actorUserId, actorType: "tenant_user", action: "tenant.email_changed", entity: "Tenant", entityId: tenantId });
      return { status: "ok", requiresConfirmation: false };
    }

    const codigo = this.generateCode();
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

  /** Reenvia o código pendente (troca de e-mail OU confirmação inicial do cadastro) para o mesmo endereço, com um código novo. */
  async resendCode(tenantId: string, actorUserId: string): Promise<{ status: "ok" }> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    if (tenant.emailConfirmado && !tenant.emailPendente) {
      throw new BadRequestException("Não há confirmação de e-mail pendente.");
    }

    const destino = tenant.emailPendente ?? tenant.email;
    const codigo = this.generateCode();
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { emailPendenteCodigo: hashOpaqueToken(codigo), emailPendenteExpira: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.notifications.enqueueEmailConfirmationCode({ tenantId, tenantUserId: actorUserId, email: destino, codigo });

    return { status: "ok" };
  }

  async confirmEmailChange(tenantId: string, actorUserId: string, codigo: string): Promise<{ status: "ok" }> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    if (!tenant.emailPendenteCodigo || !tenant.emailPendenteExpira) {
      throw new BadRequestException("Não há confirmação de e-mail pendente.");
    }
    if (tenant.emailPendenteExpira < new Date()) {
      throw new BadRequestException("Código expirado — solicite um novo código.");
    }
    if (tenant.emailPendenteCodigo !== hashOpaqueToken(codigo)) {
      throw new BadRequestException("Código inválido.");
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // Sem `emailPendente` (caso 1: confirmação inicial do cadastro), o
        // e-mail atual é mantido — só `emailConfirmado` muda.
        ...(tenant.emailPendente ? { email: tenant.emailPendente } : {}),
        emailPendente: null,
        emailPendenteCodigo: null,
        emailPendenteExpira: null,
        emailConfirmado: true,
      },
    });

    await this.audit.record({ actorId: actorUserId, actorType: "tenant_user", action: "tenant.email_confirmed", entity: "Tenant", entityId: tenantId });

    return { status: "ok" };
  }

  private generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }
}
