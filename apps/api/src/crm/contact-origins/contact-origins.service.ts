import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateContactOriginDto } from "./dto/create-contact-origin.dto";
import type { UpdateContactOriginDto } from "./dto/update-contact-origin.dto";

/** Configurações do CRM > Origens dos contatos (documento de alterações, item 11.1). */
@Injectable()
export class ContactOriginsService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.contactOrigin.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  }

  private async get(id: string) {
    const origin = await this.tenantPrisma.contactOrigin.findFirst({ where: { id } });
    if (!origin) {
      throw new NotFoundException("Origem não encontrada.");
    }
    return origin;
  }

  async create(dto: CreateContactOriginDto, actorId: string) {
    const existing = await this.tenantPrisma.contactOrigin.findFirst({ where: { nome: dto.nome } });
    if (existing) {
      throw new ConflictException("Já existe uma origem com esse nome.");
    }

    const origin = await this.tenantPrisma.contactOrigin.create({ data: { nome: dto.nome } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "contact_origin.create", entity: "ContactOrigin", entityId: origin.id, newData: { nome: origin.nome } });

    return origin;
  }

  async update(id: string, dto: UpdateContactOriginDto, actorId: string) {
    await this.get(id);

    const origin = await this.tenantPrisma.contactOrigin.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.ordem !== undefined ? { ordem: dto.ordem } : {}),
      },
    });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "contact_origin.update", entity: "ContactOrigin", entityId: id });

    return origin;
  }

  /** Exige `substitutaId` quando a origem está em uso (item 11.1: "informar os contatos vinculados e solicitar uma origem substituta"). */
  async remove(id: string, substitutaId: string | undefined, actorId: string) {
    await this.get(id);
    const contactsUsing = await this.tenantPrisma.contact.count({ where: { origemId: id, deletedAt: null } });

    if (contactsUsing > 0) {
      if (!substitutaId) {
        throw new ConflictException({
          message: `Esta origem está em uso por ${contactsUsing} contato(s). Selecione uma origem substituta para continuar.`,
          contactsUsing,
        });
      }
      if (substitutaId === id) {
        throw new BadRequestException("A origem substituta deve ser diferente da origem removida.");
      }
      await this.get(substitutaId);
      await this.tenantPrisma.contact.updateMany({ where: { origemId: id }, data: { origemId: substitutaId } });
    }

    await this.tenantPrisma.contactOrigin.delete({ where: { id } });

    await this.audit.record({ actorId, actorType: "tenant_user", action: "contact_origin.remove", entity: "ContactOrigin", entityId: id, previousData: { substitutaId: substitutaId ?? null } });

    return { status: "ok" as const };
  }
}
