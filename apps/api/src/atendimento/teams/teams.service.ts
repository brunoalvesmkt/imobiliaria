import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import type { CreateTeamDto } from "./dto/create-team.dto";
import type { UpdateTeamDto } from "./dto/update-team.dto";
import type { AddMemberDto } from "./dto/add-member.dto";
import type { UpdateMemberDto } from "./dto/update-member.dto";

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.team.findMany({
      orderBy: { nome: "asc" },
      include: { members: { include: { tenantUser: { select: { id: true, nome: true, email: true } } } } },
    });
  }

  async get(id: string) {
    const team = await this.tenantPrisma.team.findFirst({
      where: { id },
      include: { members: { include: { tenantUser: { select: { id: true, nome: true, email: true } } } } },
    });
    if (!team) {
      throw new NotFoundException("Equipe não encontrada.");
    }
    return team;
  }

  async create(dto: CreateTeamDto, actorId: string) {
    const team = await this.tenantPrisma.team.create({ data: { nome: dto.nome } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.create",
      entity: "Team",
      entityId: team.id,
      newData: { nome: team.nome },
    });

    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actorId: string) {
    const team = await this.get(id);
    const updated = await this.tenantPrisma.team.update({ where: { id }, data: { ...dto } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.update",
      entity: "Team",
      entityId: id,
      previousData: { nome: team.nome },
      newData: { ...dto },
    });

    return updated;
  }

  async deactivate(id: string, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.team.update({ where: { id }, data: { ativo: false } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.deactivate",
      entity: "Team",
      entityId: id,
    });

    return updated;
  }

  async reactivate(id: string, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.team.update({ where: { id }, data: { ativo: true } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.reactivate",
      entity: "Team",
      entityId: id,
    });

    return updated;
  }

  /**
   * Exclusão definitiva — cascata apaga os membros e as mensagens rápidas
   * (QuickMessage) restritas a esta equipe; filas vinculadas ficam sem
   * equipe (onDelete: SetNull no schema), não são apagadas. Quem quiser
   * manter esse histórico deve usar "Inativar" em vez de excluir.
   */
  async remove(id: string, actorId: string) {
    const team = await this.get(id);
    await this.tenantPrisma.team.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.delete",
      entity: "Team",
      entityId: id,
      previousData: { nome: team.nome },
    });

    return { status: "ok" as const };
  }

  async addMember(teamId: string, dto: AddMemberDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.get(teamId);

    const tenantUser = await this.tenantPrisma.tenantUser.findFirst({ where: { id: dto.tenantUserId, deletedAt: null } });
    if (!tenantUser) {
      throw new NotFoundException("Usuário não encontrado.");
    }

    const existing = await this.prisma.teamMember.findFirst({ where: { teamId, tenantUserId: dto.tenantUserId } });
    if (existing) {
      throw new ConflictException("Usuário já é membro desta equipe.");
    }

    const member = await this.prisma.teamMember.create({
      data: { teamId, tenantUserId: dto.tenantUserId, papel: dto.papel ?? "agent", prioridade: dto.prioridade ?? 0 },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.add_member",
      entity: "Team",
      entityId: teamId,
      tenantId,
      newData: { tenantUserId: dto.tenantUserId, papel: member.papel },
    });

    return member;
  }

  async updateMemberPriority(teamId: string, tenantUserId: string, dto: UpdateMemberDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.get(teamId);

    const member = await this.prisma.teamMember.findFirst({ where: { teamId, tenantUserId } });
    if (!member) {
      throw new NotFoundException("Este usuário não é membro da equipe.");
    }

    const updated = await this.prisma.teamMember.update({ where: { id: member.id }, data: { prioridade: dto.prioridade } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.update_member_priority",
      entity: "Team",
      entityId: teamId,
      tenantId,
      previousData: { prioridade: member.prioridade },
      newData: { prioridade: updated.prioridade },
    });

    return updated;
  }

  async removeMember(teamId: string, tenantUserId: string, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.get(teamId);

    const member = await this.prisma.teamMember.findFirst({ where: { teamId, tenantUserId } });
    if (!member) {
      throw new NotFoundException("Este usuário não é membro da equipe.");
    }

    await this.prisma.teamMember.delete({ where: { id: member.id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "team.remove_member",
      entity: "Team",
      entityId: teamId,
      tenantId,
      previousData: { tenantUserId },
    });

    return { status: "ok" as const };
  }
}
