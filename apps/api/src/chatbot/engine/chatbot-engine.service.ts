import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import type { ChatbotExecution, Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantScopedPrismaService } from "../../prisma/tenant-scoped-prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { requireCurrentTenantId } from "../../common/tenant/tenant-context";
import { ProviderRegistryService } from "../../whatsapp/providers/provider-registry.service";
import { RealtimeGateway } from "../../realtime/realtime.gateway";
import { DomainEventsService } from "../../common/events/domain-events.service";
import type { DomainEventName } from "../../common/events/domain-event.types";
import { AiAccessService } from "../../ai/ai-access.service";
import { AiProviderRegistryService } from "../../ai/providers/ai-provider-registry.service";
import type { AiProviderName } from "../../ai/providers/ai-provider-registry.service";
import { validateAnswer } from "./answer-validation.util";
import { classifyLeadScore } from "../../crm/lead-score.util";
import { LeadScoreConfigService } from "../../crm/lead-score-config.service";
import { ChatbotTimeoutProducer } from "./chatbot-timeout.producer";
import { FilesService } from "../../files/files.service";
import type {
  AiNodeData,
  ConditionNodeData,
  CrmStageNodeData,
  FlowDefinition,
  FlowNode,
  KnowledgeQueryNodeData,
  MenuNodeData,
  QuestionNodeData,
  SubflowNodeData,
  TransferNodeData,
  MessageNodeData,
} from "../flow-definition.types";
import { TIMEOUT_NODE_TYPES, TIMEOUT_HANDLE, TIMEOUT_LIMIT_HANDLE, timeoutUnitToMs, type TimeoutUnit } from "../flow-definition.types";

const MAX_STEPS_PER_ADVANCE = 25;
const DEFAULT_MAX_TENTATIVAS = 3;
const DEFAULT_TIMEOUT_MAX_TENTATIVAS = 1;

interface CallStackFrame {
  flowId: string;
  versao: number;
  returnNodeId: string;
}

interface ExecutionContext {
  activeFlowId?: string;
  activeVersao?: number;
  callStack?: CallStackFrame[];
  retryCounts?: Record<string, number>;
  /** Nº de reativações por falta de resposta já disparadas para cada card, nesta execução — ver triggerTimeout. Resetado quando o card é respondido. */
  timeoutAttempts?: Record<string, number>;
  answers?: Record<string, string>;
  /** Histórico de conversa com a IA, compartilhado por todos os cards "ai"/"knowledge_query" desta execução — ver runAiNodeOrTransfer. */
  aiHistory?: { role: "user" | "assistant"; content: string }[];
}

const AI_HISTORY_MAX_MESSAGES = 20;

@Injectable()
export class ChatbotEngineService {
  private readonly logger = new Logger(ChatbotEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantScopedPrismaService,
    private readonly audit: AuditService,
    private readonly providers: ProviderRegistryService,
    private readonly realtime: RealtimeGateway,
    private readonly domainEvents: DomainEventsService,
    private readonly aiAccess: AiAccessService,
    private readonly aiProviders: AiProviderRegistryService,
    private readonly leadScoreConfig: LeadScoreConfigService,
    private readonly timeoutProducer: ChatbotTimeoutProducer,
    private readonly files: FilesService,
  ) {}

  async startFlow(flowId: string, conversationId: string): Promise<ChatbotExecution> {
    const flow = await this.prisma.chatbotFlow.findUniqueOrThrow({ where: { id: flowId } });
    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } });

    const execution = await this.tenantPrisma.chatbotExecution.create({
      data: {
        chatbotFlowId: flow.id,
        versao: flow.versaoAtual,
        conversationId,
        contactId: conversation.contactId,
        status: "running",
        currentNodeId: "start",
        contextData: {} as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      actorId: "system:chatbot-engine",
      actorType: "tenant_user",
      action: "chatbot_execution.start",
      entity: "ChatbotExecution",
      entityId: execution.id,
      newData: { chatbotFlowId: flow.id, conversationId },
    });

    return this.advance(execution);
  }

  async handleReply(execution: ChatbotExecution, incomingText: string): Promise<ChatbotExecution> {
    if (execution.status !== "running" || !execution.currentNodeId) {
      return execution;
    }

    const { definition } = await this.resolveActiveDefinition(execution);
    const node = definition.nodes.find((n) => n.id === execution.currentNodeId);
    if (!node) {
      return execution;
    }

    // Qualquer resposta do cliente cancela o timeout de reengajamento pendente deste card, se houver.
    await this.timeoutProducer.cancel(execution.id);

    if (node.type === "question") {
      return this.handleQuestionReply(execution, node, incomingText);
    }
    if (node.type === "menu") {
      return this.handleMenuReply(execution, node, incomingText);
    }
    return execution;
  }

  // ---------------------------------------------------------------------
  // Núcleo do motor
  // ---------------------------------------------------------------------

  private async advance(execution: ChatbotExecution): Promise<ChatbotExecution> {
    let current = execution;
    let context = (current.contextData as ExecutionContext | null) ?? {};
    let steps = 0;

    while (steps < MAX_STEPS_PER_ADVANCE) {
      steps += 1;
      const { definition, flowId, versao } = await this.resolveActiveDefinition(current, context);
      const node = definition.nodes.find((n) => n.id === current.currentNodeId);
      if (!node) {
        return this.finish(current, "abandoned", context);
      }

      switch (node.type) {
        case "start": {
          const next = this.singleOutgoing(definition, node.id);
          current = { ...current, currentNodeId: next };
          continue;
        }

        case "message": {
          await this.sendNodeMessage(current, node.data as unknown as MessageNodeData);
          const next = this.singleOutgoing(definition, node.id);
          current = { ...current, currentNodeId: next };
          continue;
        }

        case "question": {
          await this.sendText(current, (node.data as unknown as QuestionNodeData).texto);
          const persisted = await this.persist(current, node.id, "running", context);
          await this.scheduleTimeoutIfConfigured(persisted, node);
          return persisted;
        }

        case "menu": {
          const data = node.data as unknown as MenuNodeData;
          const opcoesTexto = data.opcoes.map((o) => `${o.chave}) ${o.texto}`).join("\n");
          await this.sendText(current, `${data.texto}\n${opcoesTexto}`);
          const persisted = await this.persist(current, node.id, "running", context);
          await this.scheduleTimeoutIfConfigured(persisted, node);
          return persisted;
        }

        case "condition": {
          const data = node.data as unknown as ConditionNodeData;
          const result = this.evaluateCondition(context, data);
          const next = this.handleOutgoing(definition, node.id, result ? "true" : "false");
          current = { ...current, currentNodeId: next };
          continue;
        }

        case "ai": {
          const data = node.data as unknown as AiNodeData;
          const transferred = await this.runAiNodeOrTransfer(
            current,
            data.provider,
            this.substituteVariables(data.prompt, context),
            context,
          );
          if (transferred.status === "transferred") {
            return this.finish(current, "transferred", context);
          }
          context = transferred.context;
          if (data.variavel) {
            context = { ...context, answers: { ...(context.answers ?? {}), [data.variavel]: transferred.text } };
          }
          const next = this.singleOutgoing(definition, node.id);
          current = { ...current, currentNodeId: next };
          continue;
        }

        case "knowledge_query": {
          const data = node.data as unknown as KnowledgeQueryNodeData;
          const items = await this.searchKnowledgeBase(data.tipo, context, data.provider);
          const systemPrompt = this.buildKnowledgeSystemPrompt(items);
          const question = this.lastAnswer(context) ?? "Responda com base nas informações fornecidas.";
          const transferred = await this.runAiNodeOrTransfer(current, data.provider, question, context, systemPrompt);
          if (transferred.status === "transferred") {
            return this.finish(current, "transferred", context);
          }
          context = transferred.context;
          if (data.variavel) {
            context = { ...context, answers: { ...(context.answers ?? {}), [data.variavel]: transferred.text } };
          }
          const next = this.singleOutgoing(definition, node.id);
          current = { ...current, currentNodeId: next };
          continue;
        }

        case "crm_stage": {
          const data = node.data as unknown as CrmStageNodeData;
          await this.addToCrmStage(current, data);
          const next = this.singleOutgoing(definition, node.id);
          current = { ...current, currentNodeId: next };
          continue;
        }

        case "subflow": {
          const data = node.data as unknown as SubflowNodeData;
          const returnNodeId = this.singleOutgoing(definition, node.id);
          const subflow = await this.prisma.chatbotFlow.findUniqueOrThrow({ where: { id: data.subflowId } });

          const stack = context.callStack ?? [];
          stack.push({ flowId, versao, returnNodeId });
          context = { ...context, callStack: stack, activeFlowId: subflow.id, activeVersao: subflow.versaoAtual };
          current = { ...current, currentNodeId: "start" };
          continue;
        }

        case "transfer": {
          await this.transferToHuman(current, node.data as TransferNodeData);
          return this.finish(current, "transferred", context);
        }

        case "end": {
          const stack = context.callStack ?? [];
          const frame = stack.pop();
          if (frame) {
            context = { ...context, callStack: stack, activeFlowId: frame.flowId, activeVersao: frame.versao };
            current = { ...current, currentNodeId: frame.returnNodeId };
            continue;
          }
          return this.finish(current, "completed", context);
        }

        default:
          return this.finish(current, "abandoned", context);
      }
    }

    this.logger.warn(`Execução ${current.id} atingiu o limite de ${MAX_STEPS_PER_ADVANCE} passos — possível loop.`);
    return this.finish(current, "abandoned", context);
  }

  private async handleQuestionReply(
    execution: ChatbotExecution,
    node: FlowNode,
    incomingText: string,
  ): Promise<ChatbotExecution> {
    const data = node.data as unknown as QuestionNodeData;
    const context = (execution.contextData as ExecutionContext | null) ?? {};
    const valid = validateAnswer(data.validacao, incomingText);

    if (!valid) {
      return this.handleInvalidAnswer(execution, node, context, data.mensagemErro, data.maxTentativas);
    }

    const answers = { ...(context.answers ?? {}), [data.variavel]: incomingText };
    const timeoutAttempts = { ...context.timeoutAttempts };
    delete timeoutAttempts[node.id];
    const nextContext: ExecutionContext = { ...context, answers, retryCounts: { ...context.retryCounts, [node.id]: 0 }, timeoutAttempts };

    if (data.salvarNoCrm) {
      await this.saveAnswerToCrm(execution, data.salvarNoCrm, incomingText);
    }
    if (data.pontuacao) {
      await this.addLeadScore(execution, data.pontuacao);
    }

    const { definition } = await this.resolveActiveDefinition(execution, nextContext);
    const next = this.singleOutgoing(definition, node.id);
    const advanced = await this.persist(execution, next, "running", nextContext);
    return this.advance(advanced);
  }

  private async handleMenuReply(
    execution: ChatbotExecution,
    node: FlowNode,
    incomingText: string,
  ): Promise<ChatbotExecution> {
    const data = node.data as unknown as MenuNodeData;
    const context = (execution.contextData as ExecutionContext | null) ?? {};
    const normalized = incomingText.trim().toLowerCase();
    const chosen = data.opcoes.find(
      (o) => o.chave.toLowerCase() === normalized || o.texto.toLowerCase() === normalized,
    );

    if (!chosen) {
      return this.handleInvalidAnswer(execution, node, context, data.mensagemErro, data.maxTentativas);
    }

    if (data.variavel) {
      context.answers = { ...(context.answers ?? {}), [data.variavel]: chosen.chave };
    }
    context.retryCounts = { ...context.retryCounts, [node.id]: 0 };
    const timeoutAttempts = { ...context.timeoutAttempts };
    delete timeoutAttempts[node.id];
    context.timeoutAttempts = timeoutAttempts;
    if (chosen.pontuacao) {
      await this.addLeadScore(execution, chosen.pontuacao);
    }

    const { definition } = await this.resolveActiveDefinition(execution, context);
    const next = this.handleOutgoing(definition, node.id, chosen.chave);
    const advanced = await this.persist(execution, next, "running", context);
    return this.advance(advanced);
  }

  private async handleInvalidAnswer(
    execution: ChatbotExecution,
    node: FlowNode,
    context: ExecutionContext,
    mensagemErro: string | undefined,
    maxTentativas: number | undefined,
  ): Promise<ChatbotExecution> {
    const retryCounts = { ...context.retryCounts };
    const attempts = (retryCounts[node.id] ?? 0) + 1;
    retryCounts[node.id] = attempts;
    const limit = maxTentativas ?? DEFAULT_MAX_TENTATIVAS;

    if (attempts >= limit) {
      await this.sendText(execution, "Não consegui entender sua resposta. Vou te transferir para um atendente.");
      await this.transferToHuman(execution, {});
      return this.finish(execution, "transferred", { ...context, retryCounts });
    }

    await this.sendText(execution, mensagemErro ?? "Não entendi, pode responder novamente?");
    const persisted = await this.persist(execution, node.id, "running", { ...context, retryCounts });
    await this.scheduleTimeoutIfConfigured(persisted, node);
    return persisted;
  }

  /**
   * Reativação por falta de resposta (question/menu) — jamais lança: card sem a funcionalidade
   * ativada simplesmente não agenda nada. Cada tentativa pode ter seu próprio tempo de espera
   * (`timeoutSteps[N]` = espera antes da (N+1)-ésima reativação); o índice usado é o nº de
   * reativações já disparadas para este card nesta execução (`context.timeoutAttempts`) — 0 na
   * primeira vez que o card é enviado, 1 depois da 1ª reativação, e assim por diante. Além do
   * fim do array, repete o último passo configurado.
   */
  private async scheduleTimeoutIfConfigured(execution: ChatbotExecution, node: FlowNode): Promise<void> {
    if (!TIMEOUT_NODE_TYPES.includes(node.type)) {
      return;
    }
    const data = node.data as unknown as { timeoutEnabled?: boolean; timeoutSteps?: { quantidade?: number; unidade?: TimeoutUnit }[] };
    if (!data.timeoutEnabled || !data.timeoutSteps || data.timeoutSteps.length === 0) {
      return;
    }
    const context = (execution.contextData as ExecutionContext | null) ?? {};
    const attempts = context.timeoutAttempts?.[node.id] ?? 0;
    const step = data.timeoutSteps[Math.min(attempts, data.timeoutSteps.length - 1)];
    if (!step?.quantidade || step.quantidade <= 0) {
      return;
    }
    const delayMs = timeoutUnitToMs(step.quantidade, step.unidade ?? "minutes");
    await this.timeoutProducer.schedule(execution.id, node.id, delayMs);
  }

  /**
   * Chamado pelo ChatbotTimeoutProcessor quando o cliente não responde a tempo. Conta mais uma
   * tentativa para o card atual (`context.timeoutAttempts`); dentro do limite configurado, segue
   * pela saída "Não respondeu" (TIMEOUT_HANDLE) — se essa saída apontar para o próprio card, o
   * `advance()` naturalmente reenvia a pergunta e reagenda um novo timeout, sem lógica especial de
   * "repetição". Ao esgotar o limite, segue pela saída opcional "Limite atingido"
   * (TIMEOUT_LIMIT_HANDLE) — se não estiver conectada, a execução é encerrada.
   */
  async triggerTimeout(execution: ChatbotExecution): Promise<ChatbotExecution> {
    const context = (execution.contextData as ExecutionContext | null) ?? {};
    const { definition } = await this.resolveActiveDefinition(execution, context);
    const node = definition.nodes.find((n) => n.id === execution.currentNodeId);
    if (!node) {
      return this.finish(execution, "abandoned", context);
    }
    const data = node.data as unknown as { timeoutMaxTentativas?: number };

    const timeoutAttempts = { ...context.timeoutAttempts };
    const attempts = (timeoutAttempts[node.id] ?? 0) + 1;
    timeoutAttempts[node.id] = attempts;
    const nextContext: ExecutionContext = { ...context, timeoutAttempts };
    const limit = data.timeoutMaxTentativas ?? DEFAULT_TIMEOUT_MAX_TENTATIVAS;

    if (attempts > limit) {
      const limitEdge = definition.edges.find((e) => e.source === node.id && e.sourceHandle === TIMEOUT_LIMIT_HANDLE);
      if (!limitEdge) {
        return this.finish(execution, "abandoned", nextContext);
      }
      const advanced = await this.persist(execution, limitEdge.target, "running", nextContext);
      return this.advance(advanced);
    }

    const timeoutEdge = definition.edges.find((e) => e.source === node.id && e.sourceHandle === TIMEOUT_HANDLE);
    if (!timeoutEdge) {
      this.logger.warn(`Execução ${execution.id}: card "${node.id}" sem saída "Não respondeu" conectada — fluxo publicado inválido.`);
      return this.finish(execution, "abandoned", nextContext);
    }
    const advanced = await this.persist(execution, timeoutEdge.target, "running", nextContext);
    return this.advance(advanced);
  }


  // ---------------------------------------------------------------------
  // Auxiliares
  // ---------------------------------------------------------------------

  private async resolveActiveDefinition(
    execution: ChatbotExecution,
    contextOverride?: ExecutionContext,
  ): Promise<{ definition: FlowDefinition; flowId: string; versao: number }> {
    const context = contextOverride ?? ((execution.contextData as ExecutionContext | null) ?? {});
    const flowId = context.activeFlowId ?? execution.chatbotFlowId;
    const versao = context.activeVersao ?? execution.versao;

    const version = await this.prisma.chatbotFlowVersion.findUniqueOrThrow({
      where: { chatbotFlowId_versao: { chatbotFlowId: flowId, versao } },
    });

    return { definition: version.definicao as unknown as FlowDefinition, flowId, versao };
  }

  /**
   * Saída "principal" de um card — ignora deliberadamente as saídas reservadas de reativação
   * por timeout (TIMEOUT_HANDLE/TIMEOUT_LIMIT_HANDLE), que podem coexistir com ela no mesmo nó
   * (question/menu com reativação ativada), senão a primeira edge encontrada poderia ser a de
   * timeout em vez do fluxo normal de resposta.
   */
  private singleOutgoing(definition: FlowDefinition, nodeId: string): string {
    const edge = definition.edges.find(
      (e) => e.source === nodeId && e.sourceHandle !== TIMEOUT_HANDLE && e.sourceHandle !== TIMEOUT_LIMIT_HANDLE,
    );
    if (!edge) {
      throw new Error(`Card "${nodeId}" não tem conexão de saída — fluxo publicado inválido.`);
    }
    return edge.target;
  }

  private handleOutgoing(definition: FlowDefinition, nodeId: string, handle: string): string {
    const edge = definition.edges.find((e) => e.source === nodeId && e.sourceHandle === handle);
    if (!edge) {
      throw new Error(`Card "${nodeId}" não tem conexão de saída para "${handle}".`);
    }
    return edge.target;
  }

  private evaluateCondition(context: ExecutionContext, data: ConditionNodeData): boolean {
    const value = context.answers?.[data.campo];
    switch (data.operador) {
      case "exists":
        return value !== undefined && value !== "";
      case "not_exists":
        return value === undefined || value === "";
      case "contains":
        return typeof value === "string" && typeof data.valor === "string" && value.includes(data.valor);
      case "equals":
      default:
        return value === data.valor;
    }
  }

  private async persist(
    execution: ChatbotExecution,
    currentNodeId: string,
    status: string,
    context: ExecutionContext,
  ): Promise<ChatbotExecution> {
    return this.tenantPrisma.chatbotExecution.update({
      where: { id: execution.id },
      data: {
        currentNodeId,
        status,
        contextData: context as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async finish(
    execution: ChatbotExecution,
    status: "completed" | "abandoned" | "transferred",
    context: ExecutionContext,
  ): Promise<ChatbotExecution> {
    const updated = await this.tenantPrisma.chatbotExecution.update({
      where: { id: execution.id },
      data: {
        status,
        finishedAt: new Date(),
        contextData: context as unknown as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      actorId: "system:chatbot-engine",
      actorType: "tenant_user",
      action: `chatbot_execution.${status}`,
      entity: "ChatbotExecution",
      entityId: execution.id,
    });

    const eventByStatus: Record<typeof status, DomainEventName> = {
      completed: "chatbot.flow.completed",
      abandoned: "chatbot.flow.abandoned",
      transferred: "chatbot.flow.transferred",
    };
    this.domainEvents.emit(eventByStatus[status], {
      tenantId: execution.tenantId,
      conversationId: execution.conversationId,
      contactId: execution.contactId ?? undefined,
      data: { chatbotExecutionId: execution.id, chatbotFlowId: execution.chatbotFlowId },
    });

    return updated;
  }

  private async sendText(execution: ChatbotExecution, texto: string): Promise<void> {
    await this.sendNodeMessage(execution, { texto });
  }

  private async sendNodeMessage(
    execution: ChatbotExecution,
    data: Pick<MessageNodeData, "texto" | "tipo" | "midiaUrl" | "arquivoId">,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: execution.conversationId } });
    const number = await this.prisma.whatsAppNumber.findUniqueOrThrow({ where: { id: conversation.whatsAppNumberId } });

    if (number.modalidade === "unofficial") {
      const accepted = await this.prisma.riskAcceptance.findFirst({ where: { whatsAppNumberId: number.id } });
      if (!accepted) {
        this.logger.warn(`Envio do chatbot bloqueado — aceite de risco pendente no número ${number.id}.`);
        return;
      }
    }

    if (conversation.contactId) {
      const contact = await this.prisma.contact.findUnique({ where: { id: conversation.contactId }, select: { bloqueado: true } });
      if (contact?.bloqueado) {
        this.logger.warn(`Envio do chatbot bloqueado — contato ${conversation.contactId} está bloqueado.`);
        return;
      }
    }

    // Arquivo enviado por upload: a URL assinada expira em minutos, então é sempre resolvida
    // aqui, na hora do envio — nunca gravada no fluxo (ver flow-definition.types.ts).
    let midiaUrl = data.midiaUrl;
    if (data.arquivoId) {
      try {
        midiaUrl = (await this.files.createDownloadUrl(data.arquivoId)).downloadUrl;
      } catch (err) {
        this.logger.warn(
          `Execução ${execution.id}: não foi possível resolver o arquivo "${data.arquivoId}" — mensagem enviada sem mídia. (${err instanceof Error ? err.message : String(err)})`,
        );
        midiaUrl = undefined;
      }
    }

    const provider = this.providers.resolve(number.provider);
    const result = await provider.sendMessage(
      { id: number.id, tenantId: number.tenantId, numero: number.numero, externalAccountId: number.externalAccountId },
      conversation.contatoNumero,
      { tipo: data.tipo ?? "text", texto: data.texto, midiaUrl },
    );

    const message = await this.tenantPrisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "out",
        senderType: "chatbot",
        tipo: data.tipo ?? "text",
        conteudo: data.texto,
        midiaUrl: midiaUrl ?? null,
        externalId: result.externalId,
        statusEntrega: "sent",
      },
    });

    await this.tenantPrisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: message.createdAt },
    });

    this.realtime.emitToTenant(requireCurrentTenantId(), "conversation:message", {
      conversationId: conversation.id,
      message,
    });
  }

  /**
   * Chama o provedor de IA resolvido para o tenant (chave própria ou da
   * plataforma, ver AiAccessService) e envia a resposta como mensagem. Se o
   * tenant não tem acesso a IA configurado (`ForbiddenException`), transfere
   * para um atendente humano em vez de travar o fluxo — mesma filosofia do
   * `handleInvalidAnswer` ao esgotar tentativas.
   *
   * Histórico de conversa multi-turno (Fase 24): `context.aiHistory` guarda
   * as mensagens trocadas com o provedor ao longo de toda a execução — todo
   * card "ai"/"knowledge_query" da mesma execução enxerga o que já foi dito
   * antes, em vez de cada chamada partir do zero. `systemPrompt` (usado pela
   * "Consulta à Base") não entra no histórico — é reconstruído a cada
   * chamada com o contexto mais relevante para aquela pergunta específica.
   * Histórico limitado às últimas `AI_HISTORY_MAX_MESSAGES` mensagens para
   * não crescer sem limite (custo/tokens) em execuções muito longas.
   */
  private async runAiNodeOrTransfer(
    execution: ChatbotExecution,
    provider: string,
    userMessage: string,
    context: ExecutionContext,
    systemPrompt?: string,
  ): Promise<{ status: "ok"; text: string; context: ExecutionContext } | { status: "transferred" }> {
    const history = context.aiHistory ?? [];
    const messages = [...history, { role: "user" as const, content: userMessage }];
    try {
      const apiKey = await this.aiAccess.resolveApiKey(provider as AiProviderName);
      const result = await this.aiProviders.resolve(provider).complete({ apiKey, systemPrompt, messages });
      await this.sendText(execution, result.text);
      const newHistory = [...messages, { role: "assistant" as const, content: result.text }].slice(-AI_HISTORY_MAX_MESSAGES);
      return { status: "ok", text: result.text, context: { ...context, aiHistory: newHistory } };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        this.logger.warn(`Execução ${execution.id}: IA indisponível (${err.message}) — transferindo para humano.`);
        await this.sendText(execution, "No momento não consigo responder automaticamente. Vou te transferir para um atendente.");
        await this.transferToHuman(execution, {});
        return { status: "transferred" };
      }
      throw err;
    }
  }

  /** Substitui `{{variavel}}` no prompt por `contextData.answers[variavel]`, quando presente. */
  private substituteVariables(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => context.answers?.[key] ?? match);
  }

  private lastAnswer(context: ExecutionContext): string | undefined {
    const values = Object.values(context.answers ?? {});
    return values[values.length - 1];
  }

  /**
   * Busca semântica (embeddings) sobre a Base de Conhecimento do tenant,
   * quando o provedor de IA resolvido suporta `embed()` (Fase 25 — OpenAI e
   * Google, não a Anthropic, que não expõe API de embeddings própria). Cada
   * item calcula seu vetor uma vez e cacheia em `embedding` — buscas
   * seguintes reaproveitam, só a pergunta do cliente é vetorizada de novo a
   * cada chamada. Sem `embed()` disponível (provedor sem suporte, ou sem
   * chave de IA configurada), cai para a busca por palavra-chave original
   * (pontua itens por nº de termos da última resposta encontrados em
   * título/conteúdo) — nunca falha o card por causa da estratégia de busca.
   */
  private async searchKnowledgeBase(tipo: string | undefined, context: ExecutionContext, provider: string) {
    const tenantId = requireCurrentTenantId();
    const query = this.lastAnswer(context) ?? "";

    const items = await this.prisma.knowledgeBaseItem.findMany({
      where: { tenantId, ativo: true, ...(tipo ? { tipo } : {}) },
    });

    const semantic = await this.trySemanticSearch(items, query, provider);
    if (semantic) {
      return semantic;
    }

    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (terms.length === 0) {
      return items.sort((a, b) => b.prioridade - a.prioridade).slice(0, 3);
    }
    // Fase 58: variações (formas alternativas de perguntar) e palavra-chave entram na busca
    // como o próprio título/conteúdo; `prioridade` só desempata quando a pontuação de termos empata.
    return items
      .map((item) => {
        const haystack = `${item.titulo} ${item.conteudo} ${item.variacoes.join(" ")} ${item.palavraChave ?? ""}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score || b.item.prioridade - a.item.prioridade)
      .slice(0, 3)
      .map((r) => r.item);
  }

  private async trySemanticSearch<T extends { id: string; titulo: string; conteudo: string; embedding: unknown }>(
    items: T[],
    query: string,
    provider: string,
  ): Promise<T[] | null> {
    if (items.length === 0 || !query) {
      return null;
    }
    const aiProvider = this.aiProviders.resolve(provider);
    if (!aiProvider.embed) {
      return null; // provedor sem suporte a embeddings (ex.: Anthropic) — cai para palavra-chave
    }

    let apiKey: string;
    try {
      apiKey = await this.aiAccess.resolveApiKey(provider as AiProviderName);
    } catch {
      return null; // sem chave de IA disponível — cai para palavra-chave, não falha a busca
    }

    const queryVector = await aiProvider.embed({ apiKey, text: query });

    const withVectors = await Promise.all(
      items.map(async (item) => {
        let vector = item.embedding as number[] | null;
        if (!vector) {
          vector = await aiProvider.embed!({ apiKey, text: `${item.titulo}\n${item.conteudo}` });
          await this.prisma.knowledgeBaseItem.update({
            where: { id: item.id },
            data: { embedding: vector as unknown as Prisma.InputJsonValue },
          });
        }
        return { item, vector };
      }),
    );

    return withVectors
      .map(({ item, vector }) => ({ item, score: cosineSimilarity(queryVector, vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => r.item);
  }

  private buildKnowledgeSystemPrompt(items: Array<{ titulo: string; conteudo: string }>): string {
    if (items.length === 0) {
      return "Nenhuma informação relevante foi encontrada na base de conhecimento. Responda educadamente informando que não tem essa informação no momento.";
    }
    const context = items.map((i) => `### ${i.titulo}\n${i.conteudo}`).join("\n\n");
    return `Use exclusivamente as informações abaixo para responder à pergunta do cliente. Se a resposta não estiver aqui, diga que não tem essa informação.\n\n${context}`;
  }

  private async transferToHuman(execution: ChatbotExecution, data: TransferNodeData): Promise<void> {
    await this.tenantPrisma.conversation.update({
      where: { id: execution.conversationId },
      data: {
        ...(data.queueId ? { queueId: data.queueId } : {}),
        ...(data.tenantUserId ? { responsavelId: data.tenantUserId } : {}),
      },
    });

    await this.tenantPrisma.conversationEvent.create({
      data: {
        conversationId: execution.conversationId,
        tipo: "transfer",
        actorId: null,
        payload: { origem: "chatbot", queueId: data.queueId, tenantUserId: data.tenantUserId } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** Integração CRM + Chatbot (ver MODULE_DEPENDENCIES.md) — só age se o módulo CRM estiver ativo para o tenant. */
  /** Resolve (ou cria) o `Contact` vinculado à conversa desta execução — reaproveitado por `saveAnswerToCrm` e `addLeadScore`. */
  private async resolveContactId(tenantId: string, execution: ChatbotExecution): Promise<string> {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({ where: { id: execution.conversationId } });

    if (conversation.contactId) {
      return conversation.contactId;
    }

    const existing = await this.prisma.contact.findFirst({
      where: { tenantId, whatsapp: conversation.contatoNumero, deletedAt: null },
    });
    const contact =
      existing ??
      (await this.prisma.contact.create({
        data: { tenantId, nome: conversation.contatoNumero, whatsapp: conversation.contatoNumero, origem: "chatbot" },
      }));
    await this.tenantPrisma.conversation.update({ where: { id: conversation.id }, data: { contactId: contact.id } });
    return contact.id;
  }

  private async saveAnswerToCrm(execution: ChatbotExecution, campo: string, valor: string): Promise<void> {
    const tenantId = requireCurrentTenantId();
    const crmFlag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    if (!crmFlag?.enabled) {
      return;
    }

    const contactId = await this.resolveContactId(tenantId, execution);
    const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    const customFields = { ...((contact.customFields as Record<string, unknown> | null) ?? {}), [campo]: valor };
    await this.prisma.contact.update({ where: { id: contactId }, data: { customFields: customFields as Prisma.InputJsonValue } });
  }

  /**
   * Lead Score (prompt mestre §4): soma `pontos` (pode ser negativo) ao
   * `Contact.leadScore` vinculado a esta execução, clampado em [0, 100] —
   * mesmos limites da classificação sugerida pelo prompt mestre (Frio 0-39,
   * Morno 40-69, Quente 70-100). Só grava se o módulo CRM estiver ativo,
   * mesma regra de `saveAnswerToCrm` (o `Contact` é uma entidade do CRM).
   */
  private async addLeadScore(execution: ChatbotExecution, pontos: number): Promise<void> {
    const tenantId = requireCurrentTenantId();
    const crmFlag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    if (!crmFlag?.enabled) {
      return;
    }

    const contactId = await this.resolveContactId(tenantId, execution);
    const contact = await this.prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    const novoScore = Math.max(0, Math.min(100, contact.leadScore + pontos));
    await this.prisma.contact.update({ where: { id: contactId }, data: { leadScore: novoScore } });

    // Notificação "lead quente" (prompt mestre §6) — só no momento em que o
    // lead CRUZA para "quente", não a cada resposta pontuada depois disso.
    // Limiares editáveis por tenant (Fase 42) — mesmos usados pela ficha do lead.
    const thresholds = await this.leadScoreConfig.get();
    if (classifyLeadScore(novoScore, thresholds) === "quente" && classifyLeadScore(contact.leadScore, thresholds) !== "quente") {
      this.domainEvents.emit("contact.lead_hot", {
        tenantId,
        contactId,
        data: { contactId, nome: contact.nome, leadScore: novoScore },
      });
    }
  }

  /**
   * Card "Etapa do funil" — cria (ou reaproveita se já existir uma aberta
   * no mesmo funil) uma Oportunidade do CRM para o contato desta conversa
   * na etapa configurada. Mesma regra de módulo ativo de saveAnswerToCrm —
   * silenciosamente ignorado se CRM não estiver habilitado para o tenant,
   * já que "adicionar ao funil" não faz sentido sem o módulo.
   */
  private async addToCrmStage(execution: ChatbotExecution, data: CrmStageNodeData): Promise<void> {
    if (!data.funnelId || !data.stageId) {
      return;
    }
    const tenantId = requireCurrentTenantId();
    const crmFlag = await this.prisma.featureFlag.findUnique({ where: { tenantId_module: { tenantId, module: "crm" } } });
    if (!crmFlag?.enabled) {
      return;
    }

    const stage = await this.prisma.funnelStage.findFirst({
      where: { id: data.stageId, funnelId: data.funnelId, funnel: { tenantId } },
    });
    if (!stage) {
      this.logger.warn(
        `Execução ${execution.id}: etapa "${data.stageId}" não encontrada no funil "${data.funnelId}" — card "Etapa do funil" ignorado.`,
      );
      return;
    }

    const contactId = await this.resolveContactId(tenantId, execution);
    const existing = await this.prisma.opportunity.findFirst({
      where: { tenantId, contactId, funnelId: data.funnelId, status: "open", deletedAt: null },
    });

    if (existing) {
      if (existing.stageId === data.stageId) {
        return;
      }
      await this.prisma.opportunity.update({
        where: { id: existing.id },
        data: { stageId: data.stageId, probabilidade: stage.probabilidade },
      });
      await this.closeOpenCrmStageHistory(existing.id);
      await this.prisma.opportunityStageHistory.create({ data: { tenantId, opportunityId: existing.id, stageId: data.stageId } });
      return;
    }

    const opportunity = await this.prisma.opportunity.create({
      data: { tenantId, contactId, funnelId: data.funnelId, stageId: data.stageId, probabilidade: stage.probabilidade, origem: "chatbot" },
    });
    await this.prisma.opportunityStageHistory.create({ data: { tenantId, opportunityId: opportunity.id, stageId: data.stageId } });
  }

  /** Fecha a linha de histórico "aberta" (sem exitedAt) da etapa atual — mesma lógica de OpportunitiesService, duplicada aqui para não criar dependência circular entre ChatbotModule e CrmModule. */
  private async closeOpenCrmStageHistory(opportunityId: string): Promise<void> {
    const open = await this.prisma.opportunityStageHistory.findFirst({
      where: { opportunityId, exitedAt: null },
      orderBy: { enteredAt: "desc" },
    });
    if (open) {
      await this.prisma.opportunityStageHistory.update({ where: { id: open.id }, data: { exitedAt: new Date() } });
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
