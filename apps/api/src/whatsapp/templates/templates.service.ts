import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type { UpdateTemplateDto } from "./dto/update-template.dto";

/**
 * Ciclo de vida local (draft → pending → approved/rejected). A submissão
 * real para aprovação da Meta e o recebimento assíncrono do resultado
 * entram quando a API oficial estiver com credenciais reais configuradas —
 * por ora os estados são geridos manualmente pelo tenant, preparando a
 * estrutura de dados e o fluxo para quando isso for automatizado.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.whatsAppTemplate.findMany({ orderBy: { createdAt: "desc" } });
  }

  async get(id: string) {
    const template = await this.tenantPrisma.whatsAppTemplate.findFirst({ where: { id } });
    if (!template) {
      throw new NotFoundException("Template não encontrado.");
    }
    return template;
  }

  async create(dto: CreateTemplateDto, actorId: string) {
    const template = await this.tenantPrisma.whatsAppTemplate.create({
      data: {
        nome: dto.nome,
        idioma: dto.idioma ?? "pt_BR",
        categoria: dto.categoria,
        cabecalho: dto.cabecalho ?? null,
        corpo: dto.corpo,
        rodape: dto.rodape ?? null,
        ...(dto.variaveis !== undefined ? { variaveis: dto.variaveis as Prisma.InputJsonValue } : {}),
        ...(dto.botoes !== undefined ? { botoes: dto.botoes as Prisma.InputJsonValue } : {}),
        whatsAppNumberId: dto.whatsAppNumberId ?? null,
        status: "draft",
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_template.create",
      entity: "WhatsAppTemplate",
      entityId: template.id,
      newData: { nome: template.nome },
    });

    return template;
  }

  async update(id: string, dto: UpdateTemplateDto, actorId: string) {
    const before = await this.get(id);
    if (before.status !== "draft") {
      throw new BadRequestException("Só é possível editar templates em rascunho.");
    }

    const data: Prisma.WhatsAppTemplateUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.idioma !== undefined) data.idioma = dto.idioma;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.cabecalho !== undefined) data.cabecalho = dto.cabecalho;
    if (dto.corpo !== undefined) data.corpo = dto.corpo;
    if (dto.rodape !== undefined) data.rodape = dto.rodape;
    if (dto.variaveis !== undefined) data.variaveis = dto.variaveis as Prisma.InputJsonValue;
    if (dto.botoes !== undefined) data.botoes = dto.botoes as Prisma.InputJsonValue;

    const updated = await this.tenantPrisma.whatsAppTemplate.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_template.update",
      entity: "WhatsAppTemplate",
      entityId: id,
    });

    return updated;
  }

  async submit(id: string, actorId: string) {
    const template = await this.get(id);
    if (template.status !== "draft") {
      throw new BadRequestException("Só é possível enviar para aprovação templates em rascunho.");
    }

    const updated = await this.tenantPrisma.whatsAppTemplate.update({
      where: { id },
      data: { status: "pending", versao: { increment: 1 } },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_template.submit",
      entity: "WhatsAppTemplate",
      entityId: id,
    });

    return updated;
  }

  async setApproval(id: string, approved: boolean, actorId: string) {
    const template = await this.get(id);
    if (template.status !== "pending") {
      throw new BadRequestException("Só é possível aprovar/rejeitar templates com envio pendente.");
    }

    const updated = await this.tenantPrisma.whatsAppTemplate.update({
      where: { id },
      data: { status: approved ? "approved" : "rejected" },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: approved ? "whatsapp_template.approved" : "whatsapp_template.rejected",
      entity: "WhatsAppTemplate",
      entityId: id,
    });

    return updated;
  }
}
