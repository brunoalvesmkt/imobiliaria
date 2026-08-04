import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { AI_NODE_TYPES, validateFlowDefinition, type FlowDefinition } from "../flow-definition.types";
import type { CreateFlowDto } from "./dto/create-flow.dto";
import type { UpdateFlowDto } from "./dto/update-flow.dto";
import type { UpdateDefinitionDto } from "./dto/update-definition.dto";

const EMPTY_DEFINITION: FlowDefinition = {
  nodes: [{ id: "start", type: "start" }],
  edges: [],
};

@Injectable()
export class FlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.tenantPrisma.chatbotFlow.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  async get(id: string) {
    const flow = await this.tenantPrisma.chatbotFlow.findFirst({ where: { id, deletedAt: null } });
    if (!flow) {
      throw new NotFoundException("Fluxo não encontrado.");
    }
    return flow;
  }

  async getCurrentVersion(id: string) {
    const flow = await this.get(id);
    const version = await this.prisma.chatbotFlowVersion.findUnique({
      where: { chatbotFlowId_versao: { chatbotFlowId: id, versao: flow.versaoAtual } },
    });
    if (!version) {
      throw new NotFoundException("Versão do fluxo não encontrada.");
    }
    return version;
  }

  async create(dto: CreateFlowDto, actorId: string) {
    const flow = await this.tenantPrisma.chatbotFlow.create({
      data: { nome: dto.nome, descricao: dto.descricao ?? null, aiEnabled: dto.aiEnabled ?? false, status: "draft", versaoAtual: 1 },
    });

    await this.prisma.chatbotFlowVersion.create({
      data: { chatbotFlowId: flow.id, versao: 1, definicao: EMPTY_DEFINITION as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.create",
      entity: "ChatbotFlow",
      entityId: flow.id,
      newData: { nome: flow.nome },
    });

    return flow;
  }

  /** Edita nome/descrição/IA habilitada — metadados do fluxo, não o desenho (isso é `updateDefinition`, via Flow Builder). */
  async update(id: string, dto: UpdateFlowDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    await this.get(id);

    if (dto.nome !== undefined) {
      const conflict = await this.prisma.chatbotFlow.findFirst({
        where: { tenantId, nome: dto.nome, id: { not: id }, deletedAt: null },
      });
      if (conflict) {
        throw new ConflictException(`Já existe um fluxo chamado "${dto.nome}".`);
      }
    }

    const data: Prisma.ChatbotFlowUncheckedUpdateInput = {};
    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.aiEnabled !== undefined) data.aiEnabled = dto.aiEnabled;

    const updated = await this.tenantPrisma.chatbotFlow.update({ where: { id }, data });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.update",
      entity: "ChatbotFlow",
      entityId: id,
      newData: { ...dto },
    });

    return updated;
  }

  /** Nome único (mesma regra de `create`, `@@unique([tenantId, nome])`) — tenta "X (cópia)", depois "X (cópia 2)", "X (cópia 3)"... */
  private async uniqueDuplicateName(tenantId: string, baseName: string): Promise<string> {
    let candidate = `${baseName} (cópia)`;
    let counter = 2;
    while (await this.prisma.chatbotFlow.findFirst({ where: { tenantId, nome: candidate, deletedAt: null } })) {
      candidate = `${baseName} (cópia ${counter})`;
      counter++;
    }
    return candidate;
  }

  /** Duplica um fluxo (metadados + desenho da versão atual) como um novo fluxo em rascunho v1 — nunca duplica o histórico de execuções. */
  async duplicate(id: string, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const flow = await this.get(id);
    const currentVersion = await this.getCurrentVersion(id);
    const nome = await this.uniqueDuplicateName(tenantId, flow.nome);

    const newFlow = await this.tenantPrisma.chatbotFlow.create({
      data: { nome, descricao: flow.descricao, aiEnabled: flow.aiEnabled, status: "draft", versaoAtual: 1 },
    });

    await this.prisma.chatbotFlowVersion.create({
      data: { chatbotFlowId: newFlow.id, versao: 1, definicao: currentVersion.definicao as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.duplicate",
      entity: "ChatbotFlow",
      entityId: newFlow.id,
      previousData: { sourceFlowId: id },
      newData: { nome },
    });

    return newFlow;
  }

  async updateDefinition(id: string, dto: UpdateDefinitionDto, actorId: string) {
    const tenantId = requireCurrentTenantId();
    const flow = await this.get(id);
    if (flow.status !== "draft") {
      throw new BadRequestException(
        "Só é possível editar um fluxo em rascunho — crie uma nova versão a partir de um fluxo publicado/pausado.",
      );
    }

    await this.prisma.chatbotFlowVersion.update({
      where: { chatbotFlowId_versao: { chatbotFlowId: id, versao: flow.versaoAtual } },
      data: { definicao: dto as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.update_definition",
      entity: "ChatbotFlow",
      entityId: id,
      tenantId,
      newData: { nodeCount: dto.nodes.length, edgeCount: dto.edges.length },
    });

    return this.getCurrentVersion(id);
  }

  async publish(id: string, actorId: string) {
    const flow = await this.get(id);
    if (flow.status !== "draft") {
      throw new BadRequestException("Só é possível publicar um fluxo em rascunho.");
    }

    const version = await this.getCurrentVersion(id);
    const definition = version.definicao as unknown as FlowDefinition;
    const errors = validateFlowDefinition(definition);

    if (!flow.aiEnabled) {
      const aiNodes = definition.nodes.filter((n) => AI_NODE_TYPES.includes(n.type));
      for (const node of aiNodes) {
        errors.push({
          message: `Card "${node.id}" (${node.type}) requer IA habilitada — ative "Habilitar IA" nas configurações do fluxo antes de publicar.`,
          nodeId: node.id,
        });
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: "Fluxo inválido — corrija antes de publicar.", errors });
    }

    await this.prisma.chatbotFlowVersion.update({
      where: { id: version.id },
      data: { publicadaEm: new Date() },
    });
    const updated = await this.tenantPrisma.chatbotFlow.update({ where: { id }, data: { status: "published" } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.publish",
      entity: "ChatbotFlow",
      entityId: id,
      newData: { versao: flow.versaoAtual },
    });

    return updated;
  }

  async pause(id: string, actorId: string) {
    const flow = await this.get(id);
    if (flow.status !== "published") {
      throw new BadRequestException("Só é possível pausar um fluxo publicado.");
    }

    const updated = await this.tenantPrisma.chatbotFlow.update({ where: { id }, data: { status: "paused" } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.pause",
      entity: "ChatbotFlow",
      entityId: id,
    });

    return updated;
  }

  /**
   * Exclusão definitiva — diferente de `archive` (que só muda o status e
   * mantém o histórico). Só permitida sem nenhuma execução registrada
   * (mesma lógica de "não pode excluir com movimentação" já usada em
   * `ContactsService.remove`) — um fluxo com execuções vira "Arquivar" em
   * vez de excluir, para não perder o histórico de conversas que passaram
   * por ele.
   */
  async remove(id: string, actorId: string) {
    const flow = await this.get(id);
    const executionsCount = await this.tenantPrisma.chatbotExecution.findFirst({ where: { chatbotFlowId: id } });
    if (executionsCount) {
      throw new BadRequestException(
        "Este fluxo já tem execuções registradas e não pode ser excluído — use Arquivar para desativá-lo sem perder o histórico.",
      );
    }

    await this.tenantPrisma.chatbotFlow.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.delete",
      entity: "ChatbotFlow",
      entityId: id,
      previousData: { nome: flow.nome },
    });

    return { status: "ok" as const };
  }

  async archive(id: string, actorId: string) {
    await this.get(id);
    const updated = await this.tenantPrisma.chatbotFlow.update({ where: { id }, data: { status: "archived" } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.archive",
      entity: "ChatbotFlow",
      entityId: id,
    });

    return updated;
  }

  /** Cria uma nova versão em rascunho a partir da versão atual (para editar um fluxo já publicado/pausado). */
  async createNewVersion(id: string, actorId: string) {
    const flow = await this.get(id);
    if (flow.status !== "published" && flow.status !== "paused") {
      throw new BadRequestException("Só é possível versionar um fluxo publicado ou pausado.");
    }

    const currentVersion = await this.getCurrentVersion(id);
    const novaVersao = flow.versaoAtual + 1;

    await this.prisma.chatbotFlowVersion.create({
      data: { chatbotFlowId: id, versao: novaVersao, definicao: currentVersion.definicao as Prisma.InputJsonValue },
    });

    const updated = await this.tenantPrisma.chatbotFlow.update({
      where: { id },
      data: { status: "draft", versaoAtual: novaVersao },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "chatbot_flow.new_version",
      entity: "ChatbotFlow",
      entityId: id,
      newData: { versao: novaVersao },
    });

    return updated;
  }
}
