import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { slugify } from "../../auth/crypto.util";
import type { CreateCustomFieldDto } from "./dto/create-custom-field.dto";
import type { UpdateCustomFieldDto } from "./dto/update-custom-field.dto";

/**
 * Campos personalizados com tipo definido pelo admin (prompt mestre,
 * Funcionalidade 3) — a definição só descreve o campo (nome, tipo, opções);
 * o valor em si continua salvo em `Contact.customFields` (JSON), chaveado
 * por `chave`. Trocar o tipo depois de já haver valores salvos não migra
 * dado nenhum — é responsabilidade de quem edita saber disso (mesmo
 * princípio de simplicidade das outras entidades JSON do projeto).
 */
@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.customFieldDefinition.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    });
  }

  private async get(id: string) {
    const item = await this.tenantPrisma.customFieldDefinition.findFirst({ where: { id } });
    if (!item) {
      throw new NotFoundException("Campo personalizado não encontrado.");
    }
    return item;
  }

  async create(dto: CreateCustomFieldDto, actorId: string) {
    const chave = slugify(dto.chave);
    const existing = await this.tenantPrisma.customFieldDefinition.findFirst({ where: { chave } });
    if (existing) {
      throw new ConflictException(`Já existe um campo personalizado com a chave "${chave}".`);
    }

    const item = await this.tenantPrisma.customFieldDefinition.create({
      data: {
        nome: dto.nome,
        chave,
        tipo: dto.tipo,
        opcoes: (dto.opcoes ?? null) as Prisma.InputJsonValue,
        obrigatorio: dto.obrigatorio ?? false,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "custom_field_definition.create",
      entity: "CustomFieldDefinition",
      entityId: item.id,
      newData: { nome: item.nome, tipo: item.tipo },
    });

    return item;
  }

  async update(id: string, dto: UpdateCustomFieldDto, actorId: string) {
    await this.get(id);

    const data: Prisma.CustomFieldDefinitionUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.opcoes !== undefined) data.opcoes = dto.opcoes as Prisma.InputJsonValue;
    if (dto.obrigatorio !== undefined) data.obrigatorio = dto.obrigatorio;
    if (dto.ordem !== undefined) data.ordem = dto.ordem;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.tenantPrisma.customFieldDefinition.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "custom_field_definition.update",
      entity: "CustomFieldDefinition",
      entityId: id,
    });

    return updated;
  }
}
