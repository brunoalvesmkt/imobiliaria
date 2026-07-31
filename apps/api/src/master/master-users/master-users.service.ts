import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { MasterUser, Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { toCsv } from "../../reports/csv.util";
import { hashPassword } from "../../auth/crypto.util";
import type { MasterActorContext } from "../plans/plans.service";
import type { CreateMasterUserDto } from "./dto/create-master-user.dto";
import type { UpdateMasterUserDto } from "./dto/update-master-user.dto";

function toPublicMasterUser(user: MasterUser): Omit<MasterUser, "passwordHash"> {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

@Injectable()
export class MasterUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const users = await this.prisma.masterUser.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(toPublicMasterUser);
  }

  async create(dto: CreateMasterUserDto, actor: MasterActorContext) {
    const existing = await this.prisma.masterUser.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("E-mail já cadastrado.");
    }

    const passwordHash = await hashPassword(dto.senha);
    const user = await this.prisma.masterUser.create({
      data: { nome: dto.nome, email: dto.email, passwordHash, role: dto.role, status: "active" },
    });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "master_user.create",
      entity: "MasterUser",
      entityId: user.id,
      newData: { nome: user.nome, email: user.email, role: user.role },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toPublicMasterUser(user);
  }

  async update(id: string, dto: UpdateMasterUserDto, actor: MasterActorContext) {
    const before = await this.prisma.masterUser.findUnique({ where: { id } });
    if (!before) {
      throw new NotFoundException("Usuário Master não encontrado.");
    }

    const data: Prisma.MasterUserUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.masterUser.update({ where: { id }, data });

    await this.audit.record({
      actorId: actor.actorId,
      actorType: "master",
      tenantId: null,
      action: "master_user.update",
      entity: "MasterUser",
      entityId: id,
      previousData: { nome: before.nome, role: before.role, status: before.status },
      newData: { nome: updated.nome, role: updated.role, status: updated.status },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });

    return toPublicMasterUser(updated);
  }

  async exportCsv(): Promise<string> {
    const users = await this.prisma.masterUser.findMany({ orderBy: { createdAt: "asc" } });
    return toCsv(
      ["ID", "Nome", "E-mail", "Papel", "Status", "Criado em"],
      users.map((u) => [u.id, u.nome, u.email, u.role, u.status, u.createdAt.toISOString()]),
    );
  }
}
