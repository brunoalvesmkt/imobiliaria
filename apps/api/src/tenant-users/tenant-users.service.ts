import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantUser } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { TenantScopedPrismaService } from "../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { NotificationsProducer } from "../queues/notifications.producer";
import { hashPassword } from "../auth/crypto.util";
import type { CreateTenantUserDto } from "./dto/create-tenant-user.dto";
import type { UpdateTenantUserDto } from "./dto/update-tenant-user.dto";

export interface ActorContext {
  actorId: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/** Nunca devolver `passwordHash` ao cliente, mesmo em respostas de create/update. */
function toPublicTenantUser(user: TenantUser): Omit<TenantUser, "passwordHash"> {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsProducer,
  ) {}

  async get(id: string) {
    const user = await this.tenantPrisma.tenantUser.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException("Usuário não encontrado.");
    }
    return toPublicTenantUser(user);
  }

  /**
   * Durante acesso assistido (impersonação), o `sub` do token é o
   * `MasterUser.id`, não um `TenantUser` real (ver jwt-payload.interface.ts)
   * — `get(id)` sempre devolveria 404 nesse caso. Monta um perfil sintético
   * a partir do `MasterUser` real, com `roleId` do papel admin herdado que a
   * impersonação já usa, para a topbar do painel do tenant mostrar quem
   * está de fato acessando.
   */
  async getImpersonatedProfile(masterUserId: string, roleId: string) {
    const masterUser = await this.prisma.masterUser.findUniqueOrThrow({ where: { id: masterUserId } });
    return {
      id: masterUser.id,
      nome: `${masterUser.nome} (acesso assistido)`,
      email: masterUser.email,
      roleId,
      status: "active",
    };
  }

  async list() {
    return this.tenantPrisma.tenantUser.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, nome: true, email: true, roleId: true, status: true, lastLoginAt: true, createdAt: true },
    });
  }

  async create(dto: CreateTenantUserDto, actor: ActorContext, tenantId: string) {
    const existing = await this.prisma.tenantUser.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("E-mail já cadastrado.");
    }

    const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId } });
    if (!role) {
      throw new NotFoundException("Papel (role) não encontrado para este tenant.");
    }

    const passwordHash = await hashPassword(dto.senha);

    const user = await this.tenantPrisma.tenantUser.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        passwordHash,
        roleId: dto.roleId,
        status: "active",
        invitedBy: actor.actorId,
        invitedAt: new Date(),
      },
    });

    await this.audit.record({
      action: "tenant_user.create",
      entity: "TenantUser",
      entityId: user.id,
      newData: { nome: user.nome, email: user.email, roleId: user.roleId },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    await this.notifications.enqueueTenantUserWelcome({ tenantId, tenantUserId: user.id, email: user.email });

    return toPublicTenantUser(user);
  }

  async update(id: string, dto: UpdateTenantUserDto, actor: ActorContext) {
    const before = await this.tenantPrisma.tenantUser.findFirst({ where: { id, deletedAt: null } });
    if (!before) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findFirst({ where: { id: dto.roleId, tenantId: before.tenantId } });
      if (!role) {
        throw new NotFoundException("Papel (role) não encontrado para este tenant.");
      }
    }

    const data: Prisma.TenantUserUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.roleId !== undefined) data.roleId = dto.roleId;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.tenantPrisma.tenantUser.update({ where: { id }, data });

    await this.audit.record({
      action: "tenant_user.update",
      entity: "TenantUser",
      entityId: id,
      previousData: { nome: before.nome, roleId: before.roleId, status: before.status },
      newData: { nome: updated.nome, roleId: updated.roleId, status: updated.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toPublicTenantUser(updated);
  }

  async remove(id: string, actor: ActorContext) {
    const before = await this.tenantPrisma.tenantUser.findFirst({ where: { id, deletedAt: null } });
    if (!before) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    await this.tenantPrisma.tenantUser.update({ where: { id }, data: { status: "inactive", deletedAt: new Date() } });

    await this.audit.record({
      action: "tenant_user.remove",
      entity: "TenantUser",
      entityId: id,
      previousData: { status: before.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return { status: "ok" as const };
  }
}
