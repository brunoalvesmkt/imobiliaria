import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import type { CreateRoleDto } from "./dto/create-role.dto";
import type { UpdateRoleDto } from "./dto/update-role.dto";

/**
 * Perfis de acesso reutilizáveis (documento de alterações, item 16) — cada
 * tenant pode criar quantos papéis (`Role`) quiser além do "admin" padrão
 * criado no signup, cada um com seu próprio conjunto de permissões
 * (módulo × ação), e atribuir o mesmo papel a vários `TenantUser`.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    const tenantId = requireCurrentTenantId();
    return this.prisma.role.findMany({
      where: { tenantId },
      include: { permissions: true, _count: { select: { users: true } } },
      orderBy: { nome: "asc" },
    });
  }

  async get(id: string) {
    const tenantId = requireCurrentTenantId();
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: { permissions: true, _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundException("Papel não encontrado.");
    }
    return role;
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const tenantId = requireCurrentTenantId();

    const existing = await this.prisma.role.findFirst({ where: { tenantId, nome: dto.nome } });
    if (existing) {
      throw new ConflictException("Já existe um papel com esse nome.");
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        isSystem: false,
        permissions: { create: dto.permissions.map((p) => ({ module: p.module, action: p.action })) },
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "role.create",
      entity: "Role",
      entityId: role.id,
      newData: { nome: role.nome, permissionsCount: dto.permissions.length },
    });

    return this.get(role.id);
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    const before = await this.get(id);
    if (before.isSystem) {
      throw new ConflictException("O papel padrão do sistema não pode ser editado.");
    }

    if (dto.nome !== undefined) {
      const tenantId = requireCurrentTenantId();
      const existing = await this.prisma.role.findFirst({ where: { tenantId, nome: dto.nome, NOT: { id } } });
      if (existing) {
        throw new ConflictException("Já existe um papel com esse nome.");
      }
    }

    await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      },
    });

    if (dto.permissions !== undefined) {
      await this.prisma.$transaction([
        this.prisma.permission.deleteMany({ where: { roleId: id } }),
        this.prisma.permission.createMany({
          data: dto.permissions.map((p) => ({ roleId: id, module: p.module, action: p.action })),
        }),
      ]);
    }

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "role.update",
      entity: "Role",
      entityId: id,
      previousData: { nome: before.nome },
      newData: { nome: dto.nome ?? before.nome },
    });

    return this.get(id);
  }

  /** Exige `substitutaRoleId` quando o papel tem usuários vinculados — mesmo padrão de proteção usado em ContactOriginsService/FunnelsService.removeStage. */
  async remove(id: string, substitutaRoleId: string | undefined, actorId: string) {
    const role = await this.get(id);
    if (role.isSystem) {
      throw new ConflictException("O papel padrão do sistema não pode ser excluído.");
    }

    const usersCount = role._count.users;
    if (usersCount > 0) {
      if (!substitutaRoleId) {
        throw new ConflictException({
          message: `Este papel tem ${usersCount} usuário(s) vinculado(s). Selecione um papel substituto para continuar.`,
          usersCount,
        });
      }
      if (substitutaRoleId === id) {
        throw new ConflictException("O papel substituto deve ser diferente do papel removido.");
      }
      const tenantId = requireCurrentTenantId();
      const substitute = await this.prisma.role.findFirst({ where: { id: substitutaRoleId, tenantId } });
      if (!substitute) {
        throw new NotFoundException("Papel substituto não encontrado.");
      }
      await this.prisma.tenantUser.updateMany({ where: { roleId: id }, data: { roleId: substitutaRoleId } });
    }

    await this.prisma.role.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "role.remove",
      entity: "Role",
      entityId: id,
      previousData: { nome: role.nome, substitutaRoleId: substitutaRoleId ?? null },
    });

    return { status: "ok" as const };
  }
}
