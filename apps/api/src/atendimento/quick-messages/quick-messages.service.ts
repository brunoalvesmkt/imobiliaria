import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import type { CreateQuickMessageDto } from "./dto/create-quick-message.dto";
import type { UpdateQuickMessageDto } from "./dto/update-quick-message.dto";

/**
 * Mensagens rápidas (prompt mestre, Funcionalidade 9) — atalhos de texto
 * pronto para o composer do Inbox, com variáveis substituídas na hora de
 * inserir (não armazenadas já substituídas, para continuar reutilizável).
 */
@Injectable()
export class QuickMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  /** `teamId` do agente (se dado) filtra para mensagens da empresa toda (teamId null) + as da própria equipe. */
  list(teamId?: string) {
    return this.tenantPrisma.quickMessage.findMany({
      where: { ativo: true, ...(teamId ? { OR: [{ teamId: null }, { teamId }] } : {}) },
      orderBy: [{ categoria: "asc" }, { titulo: "asc" }],
    });
  }

  private async get(id: string) {
    const item = await this.tenantPrisma.quickMessage.findFirst({ where: { id } });
    if (!item) {
      throw new NotFoundException("Mensagem rápida não encontrada.");
    }
    return item;
  }

  async create(dto: CreateQuickMessageDto, actorId: string) {
    const item = await this.tenantPrisma.quickMessage.create({
      data: {
        titulo: dto.titulo,
        texto: dto.texto,
        categoria: dto.categoria ?? null,
        atalho: dto.atalho ?? null,
        teamId: dto.teamId ?? null,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "quick_message.create",
      entity: "QuickMessage",
      entityId: item.id,
      newData: { titulo: item.titulo },
    });

    return item;
  }

  async update(id: string, dto: UpdateQuickMessageDto, actorId: string) {
    await this.get(id);

    const data: Prisma.QuickMessageUncheckedUpdateInput = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo;
    if (dto.texto !== undefined) data.texto = dto.texto;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.atalho !== undefined) data.atalho = dto.atalho;
    if (dto.teamId !== undefined) data.teamId = dto.teamId;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    const updated = await this.tenantPrisma.quickMessage.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "quick_message.update",
      entity: "QuickMessage",
      entityId: id,
    });

    return updated;
  }

  /**
   * Resolve `{{contato.nome}}`, `{{contato.whatsapp}}` e `{{agente.nome}}`
   * contra a conversa/ator atuais — chamado no momento de inserir no
   * composer, não na leitura da lista (o texto salvo continua com os
   * placeholders, reutilizável em qualquer conversa).
   */
  async render(id: string, conversationId: string | undefined, actorId: string): Promise<{ texto: string }> {
    const tenantId = requireCurrentTenantId();
    const item = await this.get(id);

    let contatoNome = "";
    let contatoWhatsapp = "";
    if (conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, tenantId },
        include: { contact: { select: { nome: true, sobrenome: true } } },
      });
      contatoNome = conversation?.contact ? `${conversation.contact.nome} ${conversation.contact.sobrenome ?? ""}`.trim() : "";
      contatoWhatsapp = conversation?.contatoNumero ?? "";
    }

    const agente = await this.prisma.tenantUser.findFirst({ where: { id: actorId, tenantId }, select: { nome: true } });

    const texto = item.texto
      .replaceAll("{{contato.nome}}", contatoNome)
      .replaceAll("{{contato.whatsapp}}", contatoWhatsapp)
      .replaceAll("{{agente.nome}}", agente?.nome ?? "");

    return { texto };
  }
}
