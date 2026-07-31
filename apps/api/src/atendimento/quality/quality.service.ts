import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { DomainEventsService } from "../../common/events/domain-events.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { AiAccessService } from "../../ai/ai-access.service";
import { AiProviderRegistryService } from "../../ai/providers/ai-provider-registry.service";
import type { AiProviderName } from "../../ai/providers/ai-provider-registry.service";
import { buildEvaluationSystemPrompt, extractJson, type EvaluationResult } from "./evaluation-prompt";
import { QualityConfigService } from "./quality-config.service";

/**
 * Funcionalidade 12 do prompt mestre ("Análise de Atendimentos com IA —
 * Versão 2.0") — analisa uma conversa já registrada contra critérios fixos
 * de qualidade comercial, usando o mesmo `AiAccessService`/`AiProvider` já
 * usado pelo motor do Chatbot (Fase 11), nunca fingindo sucesso quando a IA
 * não está configurada ou não devolve um JSON válido.
 */
@Injectable()
export class QualityService {
  constructor(
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly aiAccess: AiAccessService,
    private readonly aiProviders: AiProviderRegistryService,
    private readonly qualityConfig: QualityConfigService,
  ) {}

  list(conversationId: string) {
    return this.tenantPrisma.conversationEvaluation.findMany({ where: { conversationId } });
  }

  async analyze(conversationId: string, actorId: string) {
    const conversation = await this.tenantPrisma.conversation.findFirst({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException("Conversa não encontrada.");
    }

    const messages = await this.tenantPrisma.message.findMany({ where: { conversationId } });
    if (messages.length === 0) {
      throw new BadRequestException("Esta conversa ainda não tem histórico suficiente para análise.");
    }

    const transcript = messages
      .map((m) => {
        const autor = m.direction === "in" ? "Cliente" : m.senderType === "chatbot" ? "IA" : "Atendente";
        return `${autor}: ${m.conteudo ?? "[mensagem de mídia]"}`;
      })
      .join("\n");

    const access = await this.aiAccess.getAccessSummary();
    const usable = access.providers.find((p) => p.usable);
    if (!usable) {
      throw new ForbiddenException(
        "Nenhum provedor de IA disponível para esta empresa — configure o módulo de IA antes de solicitar uma análise.",
      );
    }

    const config = await this.qualityConfig.get();
    const criterioNomes = config.criterios.map((c) => c.nome);
    const obrigatorios = config.criterios.filter((c) => c.obrigatorio).map((c) => c.nome);
    const pesoByNome = new Map(config.criterios.map((c) => [c.nome, c.peso]));

    const provider: AiProviderName = usable.provider;
    const apiKey = await this.aiAccess.resolveApiKey(provider);
    const completion = await this.aiProviders.resolve(provider).complete({
      apiKey,
      systemPrompt: buildEvaluationSystemPrompt(criterioNomes, obrigatorios),
      messages: [{ role: "user", content: transcript }],
    });

    let parsed: EvaluationResult;
    try {
      parsed = JSON.parse(extractJson(completion.text)) as EvaluationResult;
    } catch {
      throw new BadRequestException("A IA não devolveu uma avaliação em formato válido. Tente novamente.");
    }

    // Nota geral ponderada pelos pesos configurados (Fase 43) — mais
    // determinística que confiar na média que a própria IA disser ter
    // calculado; critério não reconhecido usa peso 1.
    const notaGeral = weightedAverage(parsed.criteriosAvaliados, pesoByNome) ?? parsed.notaGeral;

    const evaluation = await this.tenantPrisma.conversationEvaluation.create({
      data: {
        conversationId,
        solicitanteId: actorId,
        notaGeral,
        classificacao: parsed.classificacao,
        criteriosAvaliados: parsed.criteriosAvaliados as unknown as object,
        pontosPositivos: parsed.pontosPositivos as unknown as object,
        pontosMelhoria: parsed.pontosMelhoria as unknown as object,
        oportunidadesPerdidas: parsed.oportunidadesPerdidas as unknown as object,
        momentosCriticos: parsed.momentosCriticos as unknown as object,
        sugestoes: parsed.sugestoes as unknown as object,
        resumoExecutivo: parsed.resumoExecutivo,
        modeloUtilizado: provider,
      },
    });

    await this.audit.record({
      actorId,
      actorType: "tenant_user",
      action: "conversation.analyze",
      entity: "ConversationEvaluation",
      entityId: evaluation.id,
      newData: { conversationId, notaGeral, classificacao: parsed.classificacao },
    });

    this.domainEvents.emit("conversation.analysis_completed", {
      tenantId: requireCurrentTenantId(),
      conversationId,
      data: { conversationId, evaluationId: evaluation.id, notaGeral, classificacao: parsed.classificacao },
    });

    return evaluation;
  }
}

/** Média ponderada das notas por critério — `undefined` se a IA não devolveu nenhum critério avaliado. */
function weightedAverage(criterios: { nome: string; nota: number }[], pesoByNome: Map<string, number>): number | undefined {
  if (!criterios || criterios.length === 0) {
    return undefined;
  }
  let somaPesos = 0;
  let somaPonderada = 0;
  for (const c of criterios) {
    const peso = pesoByNome.get(c.nome) ?? 1;
    somaPesos += peso;
    somaPonderada += c.nota * peso;
  }
  if (somaPesos === 0) {
    return undefined;
  }
  return Math.round((somaPonderada / somaPesos) * 10) / 10;
}
