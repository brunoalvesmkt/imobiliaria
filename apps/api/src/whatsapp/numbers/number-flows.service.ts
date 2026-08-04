import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { normalizeTriggerText } from "../../common/text/normalize-text.util";
import type { CreateNumberFlowDto } from "./dto/create-number-flow.dto";
import type { UpdateNumberFlowDto } from "./dto/update-number-flow.dto";

/**
 * Vínculo entre uma conexão de WhatsApp e múltiplos fluxos de chatbot, cada um com sua própria
 * regra de ativação (palavra/frase específica ou qualquer mensagem) — ver ACCEPTANCE_CRITERIA.md.
 * A mesma tabela (WhatsAppNumberFlow) é a fonte de verdade tanto para a tela da conexão quanto
 * para a futura "Configuração de entrada" dentro do fluxo, nunca dados duplicados.
 */
@Injectable()
export class NumberFlowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(numberId: string) {
    await this.getNumber(numberId);
    return this.tenantPrisma.whatsAppNumberFlow.findMany({
      where: { whatsAppNumberId: numberId },
      orderBy: [{ prioridade: "asc" }, { createdAt: "asc" }],
      include: { chatbotFlow: { select: { id: true, nome: true, status: true, versaoAtual: true, updatedAt: true } } },
    });
  }

  async create(numberId: string, dto: CreateNumberFlowDto, actorId: string) {
    await this.getNumber(numberId);
    const flow = await this.getPublishedFlow(dto.chatbotFlowId);

    const termos = (dto.termos ?? []).map((t) => t.trim()).filter(Boolean);
    if (dto.regraAtivacao === "keyword" && termos.length === 0) {
      throw new BadRequestException('Informe ao menos uma palavra ou frase para a regra "Palavra ou frase específica".');
    }

    const existing = await this.tenantPrisma.whatsAppNumberFlow.findMany({ where: { whatsAppNumberId: numberId, ativo: true } });
    if (dto.regraAtivacao === "keyword") {
      await this.assertNoTermConflict(existing, termos, null);
    }
    // "Qualquer mensagem" já tem outro ativo nesta conexão: em vez de bloquear a vinculação, o
    // fluxo entra desativado — o usuário decide depois, pelo botão "Ativar" (que já confirma e
    // troca o outro automaticamente), quando quer que este passe a valer.
    const hasActiveAny = existing.some((e) => e.regraAtivacao === "any");
    const ativoInicial = dto.regraAtivacao === "any" && hasActiveAny ? false : true;

    const created = await this.tenantPrisma.whatsAppNumberFlow.create({
      data: {
        whatsAppNumberId: numberId,
        chatbotFlowId: dto.chatbotFlowId,
        regraAtivacao: dto.regraAtivacao,
        termos,
        prioridade: dto.prioridade ?? 0,
        prioritized: dto.regraAtivacao === "any" ? (dto.prioritized ?? false) : false,
        ativo: ativoInicial,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number_flow.create",
      entity: "WhatsAppNumberFlow",
      entityId: created.id,
      newData: { whatsAppNumberId: numberId, chatbotFlowId: dto.chatbotFlowId, regraAtivacao: dto.regraAtivacao, termos, flowNome: flow.nome },
    });

    return created;
  }

  async update(numberId: string, id: string, dto: UpdateNumberFlowDto, actorId: string) {
    await this.getNumber(numberId);
    const link = await this.getLink(numberId, id);

    const nextRegra = dto.regraAtivacao ?? link.regraAtivacao;
    const nextTermos = dto.termos ? dto.termos.map((t) => t.trim()).filter(Boolean) : link.termos;
    const nextAtivo = dto.ativo ?? link.ativo;

    if (nextRegra === "keyword" && nextTermos.length === 0) {
      throw new BadRequestException('Informe ao menos uma palavra ou frase para a regra "Palavra ou frase específica".');
    }

    if (nextAtivo) {
      const others = await this.tenantPrisma.whatsAppNumberFlow.findMany({
        where: { whatsAppNumberId: numberId, ativo: true, id: { not: id } },
      });
      this.assertNoAnyConflict(others, nextRegra, null);
      if (nextRegra === "keyword") {
        await this.assertNoTermConflict(others, nextTermos, null);
      }
    }

    const updated = await this.tenantPrisma.whatsAppNumberFlow.update({
      where: { id },
      data: {
        ...(dto.regraAtivacao !== undefined ? { regraAtivacao: dto.regraAtivacao } : {}),
        ...(dto.termos !== undefined ? { termos: nextTermos } : {}),
        ...(dto.prioridade !== undefined ? { prioridade: dto.prioridade } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.prioritized !== undefined ? { prioritized: dto.prioritized } : {}),
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number_flow.update",
      entity: "WhatsAppNumberFlow",
      entityId: id,
      previousData: { regraAtivacao: link.regraAtivacao, termos: link.termos, ativo: link.ativo, prioridade: link.prioridade },
      newData: { regraAtivacao: updated.regraAtivacao, termos: updated.termos, ativo: updated.ativo, prioridade: updated.prioridade },
    });

    return updated;
  }

  /**
   * Define este vínculo como O fluxo de "qualquer mensagem" da conexão, inativando
   * automaticamente qualquer outro vínculo "any" que já estivesse ativo — evita o usuário ter
   * que inativar manualmente o anterior antes de ativar o novo.
   */
  async activateAsAny(numberId: string, id: string, actorId: string) {
    await this.getNumber(numberId);
    const link = await this.getLink(numberId, id);
    if (link.regraAtivacao !== "any") {
      throw new BadRequestException('Este vínculo não usa a regra "Qualquer mensagem".');
    }

    const others = await this.tenantPrisma.whatsAppNumberFlow.findMany({
      where: { whatsAppNumberId: numberId, ativo: true, regraAtivacao: "any", id: { not: id } },
    });

    for (const other of others) {
      await this.tenantPrisma.whatsAppNumberFlow.update({ where: { id: other.id }, data: { ativo: false } });
    }
    const updated = await this.tenantPrisma.whatsAppNumberFlow.update({ where: { id }, data: { ativo: true } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number_flow.activate_as_any",
      entity: "WhatsAppNumberFlow",
      entityId: id,
      previousData: { deactivatedIds: others.map((o) => o.id) },
      newData: { ativo: true },
    });

    return updated;
  }

  async remove(numberId: string, id: string, actorId: string) {
    await this.getNumber(numberId);
    const link = await this.getLink(numberId, id);
    await this.tenantPrisma.whatsAppNumberFlow.delete({ where: { id } });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "whatsapp_number_flow.delete",
      entity: "WhatsAppNumberFlow",
      entityId: id,
      previousData: { chatbotFlowId: link.chatbotFlowId, regraAtivacao: link.regraAtivacao, termos: link.termos },
    });

    return { status: "ok" as const };
  }

  private async getNumber(numberId: string) {
    const number = await this.tenantPrisma.whatsAppNumber.findFirst({ where: { id: numberId, deletedAt: null } });
    if (!number) {
      throw new NotFoundException("Número não encontrado.");
    }
    return number;
  }

  private async getLink(numberId: string, id: string) {
    const link = await this.tenantPrisma.whatsAppNumberFlow.findFirst({ where: { id, whatsAppNumberId: numberId } });
    if (!link) {
      throw new NotFoundException("Vínculo de fluxo não encontrado nesta conexão.");
    }
    return link;
  }

  private async getPublishedFlow(chatbotFlowId: string) {
    const tenantId = requireCurrentTenantId();
    const flow = await this.prisma.chatbotFlow.findFirst({ where: { id: chatbotFlowId, tenantId, deletedAt: null } });
    if (!flow) {
      throw new NotFoundException("Fluxo não encontrado.");
    }
    if (flow.status !== "published") {
      throw new BadRequestException("Somente fluxos publicados podem ser vinculados a uma conexão de WhatsApp.");
    }
    return flow;
  }

  /** Só um fluxo "Qualquer mensagem" ativo por conexão — ver ACCEPTANCE_CRITERIA.md. */
  private assertNoAnyConflict(existing: { regraAtivacao: string }[], regraAtivacao: string, _excludeId: string | null): void {
    if (regraAtivacao !== "any") return;
    const hasAny = existing.some((e) => e.regraAtivacao === "any");
    if (hasAny) {
      throw new ConflictException(
        "Já existe um fluxo configurado para ser iniciado com qualquer mensagem nesta conexão. Desative ou altere o fluxo atual antes de ativar outro.",
      );
    }
  }

  /** Mesma palavra/frase não pode estar cadastrada em dois fluxos ativos da mesma conexão. */
  private async assertNoTermConflict(
    existing: { id: string; termos: string[]; regraAtivacao: string; chatbotFlowId: string }[],
    termos: string[],
    _excludeId: string | null,
  ): Promise<void> {
    const normalizedNew = termos.map(normalizeTriggerText);
    const keywordRules = existing.filter((e) => e.regraAtivacao === "keyword");
    if (keywordRules.length === 0 || normalizedNew.length === 0) return;

    const flowIds = keywordRules.map((r) => r.chatbotFlowId);
    const flows = await this.prisma.chatbotFlow.findMany({ where: { id: { in: flowIds } }, select: { id: true, nome: true } });
    const flowNameById = new Map(flows.map((f) => [f.id, f.nome]));

    for (const rule of keywordRules) {
      for (const termo of rule.termos) {
        if (normalizedNew.includes(normalizeTriggerText(termo))) {
          const flowNome = flowNameById.get(rule.chatbotFlowId) ?? rule.chatbotFlowId;
          throw new ConflictException(`A palavra ou frase informada já está vinculada ao fluxo "${flowNome}" nesta conexão.`);
        }
      }
    }
  }
}
