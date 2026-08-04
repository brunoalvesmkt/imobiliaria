import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import type { CreateKnowledgeItemDto } from "./dto/create-knowledge-item.dto";
import type { UpdateKnowledgeItemDto } from "./dto/update-knowledge-item.dto";

/**
 * CRUD puro — sem IA/RAG real nesta fase (nenhum LLM configurado). O
 * conteúdo fica pronto para quando o módulo de IA passar a indexar/buscar
 * sobre estes itens (ver flow-definition.types.ts, tipos "ai"/"knowledge_query"
 * rejeitados na validação de publicação até lá).
 */
@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list(tipo?: string) {
    return this.tenantPrisma.knowledgeBaseItem.findMany({
      where: tipo ? { tipo, ativo: true } : { ativo: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string) {
    const item = await this.tenantPrisma.knowledgeBaseItem.findFirst({ where: { id } });
    if (!item) {
      throw new NotFoundException("Item da base de conhecimento não encontrado.");
    }
    return item;
  }

  async create(dto: CreateKnowledgeItemDto, actorId: string) {
    const item = await this.tenantPrisma.knowledgeBaseItem.create({
      data: {
        tipo: dto.tipo,
        titulo: dto.titulo,
        conteudo: dto.conteudo,
        arquivoId: dto.arquivoId ?? null,
        campanha: dto.campanha ?? null,
        variacoes: dto.variacoes ?? [],
        palavraChave: dto.palavraChave ?? null,
        prioridade: dto.prioridade ?? 0,
        ativo: true,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "knowledge_base_item.create",
      entity: "KnowledgeBaseItem",
      entityId: item.id,
      newData: { titulo: item.titulo, tipo: item.tipo },
    });

    return item;
  }

  async update(id: string, dto: UpdateKnowledgeItemDto, actorId: string) {
    await this.get(id);

    const data: Prisma.KnowledgeBaseItemUncheckedUpdateInput = {};
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.conteudo !== undefined) data.conteudo = dto.conteudo;
    if (dto.arquivoId !== undefined) data.arquivoId = dto.arquivoId;
    if (dto.campanha !== undefined) data.campanha = dto.campanha;
    if (dto.variacoes !== undefined) data.variacoes = dto.variacoes;
    if (dto.palavraChave !== undefined) data.palavraChave = dto.palavraChave;
    if (dto.prioridade !== undefined) data.prioridade = dto.prioridade;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.tenantPrisma.knowledgeBaseItem.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "knowledge_base_item.update",
      entity: "KnowledgeBaseItem",
      entityId: id,
    });

    return updated;
  }

  async remove(id: string, actorId: string) {
    const item = await this.get(id);
    await this.tenantPrisma.knowledgeBaseItem.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "knowledge_base_item.delete",
      entity: "KnowledgeBaseItem",
      entityId: id,
      previousData: { titulo: item.titulo, tipo: item.tipo },
    });

    return { status: "ok" as const };
  }
}
