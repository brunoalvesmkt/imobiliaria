import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { requireCurrentTenantId } from "../common/tenant/tenant-context";
import type { DateRangeDto } from "./dto/date-range.dto";
import { resolveDateRange } from "./dto/date-range.dto";
import { csvEscape, toCsv } from "./csv.util";
import { toXlsx } from "./xlsx.util";
import { toPdf } from "./pdf.util";

interface TabularData {
  headers: string[];
  rows: string[][];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard "Início" — só inclui o bloco de um módulo se ele estiver
   * ativo para o tenant (`FeatureFlag`), ver MODULE_DEPENDENCIES.md §2.6.
   * Financeiro não é um módulo comercializável separadamente (sempre
   * disponível, como Configurações), por isso não é checado aqui.
   */
  async dashboard() {
    const tenantId = requireCurrentTenantId();
    const flags = await this.prisma.featureFlag.findMany({ where: { tenantId, enabled: true } });
    const activeModules = new Set(flags.map((f) => f.module));
    const since7d = new Date(Date.now() - SEVEN_DAYS_MS);

    const result: Record<string, unknown> = { modulosAtivos: [...activeModules] };

    if (activeModules.has("crm")) {
      const [totalContacts, openOpportunities, wonThisMonth, pendingTasks] = await Promise.all([
        this.prisma.contact.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.opportunity.count({ where: { tenantId, deletedAt: null, status: "open" } }),
        this.prisma.opportunity.count({
          where: { tenantId, status: "won", updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        }),
        this.prisma.crmTask.count({ where: { tenantId, status: "pending" } }),
      ]);
      result.crm = { totalContacts, openOpportunities, wonOpportunitiesThisMonth: wonThisMonth, pendingTasks };
    }

    if (activeModules.has("whatsapp")) {
      const [connectedNumbers, messagesLast7Days] = await Promise.all([
        this.prisma.whatsAppNumber.count({ where: { tenantId, deletedAt: null, status: "connected" } }),
        this.prisma.message.count({ where: { tenantId, createdAt: { gte: since7d } } }),
      ]);
      result.whatsapp = { connectedNumbers, messagesLast7Days };
    }

    if (activeModules.has("atendimento")) {
      const [openConversations, waitingInQueue] = await Promise.all([
        this.prisma.conversation.count({ where: { tenantId, deletedAt: null, status: "open" } }),
        this.prisma.conversation.count({ where: { tenantId, deletedAt: null, status: "open", responsavelId: null, queueId: { not: null } } }),
      ]);
      result.atendimento = { openConversations, conversationsWaitingQueue: waitingInQueue };
    }

    if (activeModules.has("chatbot")) {
      const [activeFlows, executionsLast7Days] = await Promise.all([
        this.prisma.chatbotFlow.count({ where: { tenantId, deletedAt: null, status: "published" } }),
        this.prisma.chatbotExecution.count({ where: { tenantId, startedAt: { gte: since7d } } }),
      ]);
      result.chatbot = { activeFlows, executionsLast7Days };
    }

    if (activeModules.has("automacao")) {
      const [activeAutomations, executionsLast7Days, deadLetterCount] = await Promise.all([
        this.prisma.automation.count({ where: { tenantId, status: "active" } }),
        this.prisma.automationExecution.count({ where: { tenantId, createdAt: { gte: since7d } } }),
        this.prisma.automationExecution.count({ where: { tenantId, status: "dead_letter" } }),
      ]);
      result.automacao = { activeAutomations, executionsLast7Days, deadLetterCount };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ["active", "overdue"] } },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    const overdueInvoicesCount = await this.prisma.invoice.count({ where: { tenantId, status: "overdue" } });
    result.financeiro = {
      subscriptionStatus: subscription?.status ?? "none",
      plano: subscription?.plan.nome ?? null,
      overdueInvoicesCount,
    };

    return result;
  }

  async crm(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const [contactsCreated, opportunitiesByStage, opportunitiesWon, opportunitiesLost, tasksPending, tasksOverdue] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } } }),
      this.prisma.opportunity.groupBy({
        by: ["stageId"],
        where: { tenantId, deletedAt: null, status: "open" },
        _count: { _all: true },
      }),
      this.prisma.opportunity.count({ where: { tenantId, status: "won", updatedAt: { gte: from, lte: to } } }),
      this.prisma.opportunity.count({ where: { tenantId, status: "lost", updatedAt: { gte: from, lte: to } } }),
      this.prisma.crmTask.count({ where: { tenantId, status: "pending" } }),
      this.prisma.crmTask.count({ where: { tenantId, status: "pending", dataHora: { lt: new Date() } } }),
    ]);

    const stages = await this.prisma.funnelStage.findMany({
      where: { id: { in: opportunitiesByStage.map((g) => g.stageId) } },
      select: { id: true, nome: true },
    });
    const stageNameById = new Map(stages.map((s) => [s.id, s.nome]));

    return {
      periodo: { from, to },
      contactsCreated,
      opportunitiesByStage: opportunitiesByStage.map((g) => ({
        stageId: g.stageId,
        nome: stageNameById.get(g.stageId) ?? "—",
        count: g._count._all,
      })),
      opportunitiesWon,
      opportunitiesLost,
      conversionRate: opportunitiesWon + opportunitiesLost > 0 ? opportunitiesWon / (opportunitiesWon + opportunitiesLost) : 0,
      tasksPending,
      tasksOverdue,
    };
  }

  async whatsapp(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const [messagesByDirection, messagesFailed, numbersByStatus] = await Promise.all([
      this.prisma.message.groupBy({
        by: ["direction"],
        where: { tenantId, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.message.count({ where: { tenantId, createdAt: { gte: from, lte: to }, statusEntrega: "failed" } }),
      this.prisma.whatsAppNumber.groupBy({
        by: ["status"],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
    ]);

    return {
      periodo: { from, to },
      messagesSent: messagesByDirection.find((g) => g.direction === "out")?._count._all ?? 0,
      messagesReceived: messagesByDirection.find((g) => g.direction === "in")?._count._all ?? 0,
      messagesFailed,
      numbersByStatus: numbersByStatus.map((g) => ({ status: g.status, count: g._count._all })),
    };
  }

  async atendimento(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const [conversationsByStatus, conversationsByQueue] = await Promise.all([
      this.prisma.conversation.groupBy({
        by: ["status"],
        where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.conversation.groupBy({
        by: ["queueId"],
        where: { tenantId, deletedAt: null, queueId: { not: null }, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);

    const queues = await this.prisma.queue.findMany({
      where: { id: { in: conversationsByQueue.map((g) => g.queueId).filter((id): id is string => id !== null) } },
      select: { id: true, nome: true },
    });
    const queueNameById = new Map(queues.map((q) => [q.id, q.nome]));

    return {
      periodo: { from, to },
      conversationsByStatus: conversationsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      conversationsByQueue: conversationsByQueue.map((g) => ({
        queueId: g.queueId,
        nome: g.queueId ? (queueNameById.get(g.queueId) ?? "—") : "—",
        count: g._count._all,
      })),
    };
  }

  async chatbot(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const executionsByStatus = await this.prisma.chatbotExecution.groupBy({
      by: ["status"],
      where: { tenantId, startedAt: { gte: from, lte: to } },
      _count: { _all: true },
    });

    const total = executionsByStatus.reduce((sum, g) => sum + g._count._all, 0);
    const completed = executionsByStatus.find((g) => g.status === "completed")?._count._all ?? 0;

    return {
      periodo: { from, to },
      executionsByStatus: executionsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      completionRate: total > 0 ? completed / total : 0,
    };
  }

  async automacao(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const executionsByStatus = await this.prisma.automationExecution.groupBy({
      by: ["status"],
      where: { tenantId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    });

    return {
      periodo: { from, to },
      executionsByStatus: executionsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
      deadLetterCount: executionsByStatus.find((g) => g.status === "dead_letter")?._count._all ?? 0,
    };
  }

  async financeiro(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const [invoicesByStatus, activeSubscriptions] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ["status"],
        where: { tenantId, createdAt: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { valor: true },
      }),
      this.prisma.subscription.findMany({ where: { tenantId, status: "active" }, include: { plan: true } }),
    ]);

    const mrr = activeSubscriptions.reduce((sum, s) => {
      const monthly = s.plan.recorrencia === "anual" ? Number(s.plan.preco) / 12 : Number(s.plan.preco);
      return sum + monthly;
    }, 0);

    return {
      periodo: { from, to },
      invoicesByStatus: invoicesByStatus.map((g) => ({
        status: g.status,
        count: g._count._all,
        total: g._sum.valor?.toString() ?? "0",
      })),
      mrr: mrr.toFixed(2),
    };
  }

  /**
   * Fase 44 (ver DEVELOPMENT_PLAN.md): "Dashboard de qualidade" e "Evolução
   * dos atendentes" do prompt mestre §12 — média por atendente, evolução
   * mensal, e pontos fortes/fracos recorrentes (contagem de texto exato nos
   * arrays `pontosPositivos`/`pontosMelhoria` das avaliações — sem
   * agrupamento semântico/NLP, débito consciente).
   */
  async qualidade(dto: DateRangeDto) {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);

    const evaluations = await this.prisma.conversationEvaluation.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      include: { conversation: { select: { responsavel: { select: { id: true, nome: true } } } } },
    });

    const round1 = (n: number) => Math.round(n * 10) / 10;

    const byAgent = new Map<string, { nome: string; soma: number; count: number }>();
    const byMonth = new Map<string, { soma: number; count: number }>();
    const positivosCount = new Map<string, number>();
    const melhoriaCount = new Map<string, number>();

    for (const ev of evaluations) {
      const agent = ev.conversation.responsavel;
      const agentKey = agent?.id ?? "sem_responsavel";
      const agentEntry = byAgent.get(agentKey) ?? { nome: agent?.nome ?? "Sem responsável", soma: 0, count: 0 };
      agentEntry.soma += ev.notaGeral;
      agentEntry.count += 1;
      byAgent.set(agentKey, agentEntry);

      const monthKey = `${ev.createdAt.getFullYear()}-${String(ev.createdAt.getMonth() + 1).padStart(2, "0")}`;
      const monthEntry = byMonth.get(monthKey) ?? { soma: 0, count: 0 };
      monthEntry.soma += ev.notaGeral;
      monthEntry.count += 1;
      byMonth.set(monthKey, monthEntry);

      for (const texto of ev.pontosPositivos as unknown as string[]) {
        positivosCount.set(texto, (positivosCount.get(texto) ?? 0) + 1);
      }
      for (const texto of ev.pontosMelhoria as unknown as string[]) {
        melhoriaCount.set(texto, (melhoriaCount.get(texto) ?? 0) + 1);
      }
    }

    const topRecorrentes = (counts: Map<string, number>) =>
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([texto, count]) => ({ texto, count }));

    return {
      periodo: { from, to },
      totalAvaliacoes: evaluations.length,
      notaMedia: evaluations.length > 0 ? round1(evaluations.reduce((sum, e) => sum + e.notaGeral, 0) / evaluations.length) : 0,
      mediaPorAtendente: [...byAgent.entries()]
        .map(([id, e]) => ({ id, nome: e.nome, media: round1(e.soma / e.count), avaliacoes: e.count }))
        .sort((a, b) => b.media - a.media),
      evolucaoMensal: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, e]) => ({ mes, media: round1(e.soma / e.count), avaliacoes: e.count })),
      pontosFortesRecorrentes: topRecorrentes(positivosCount),
      pontosFracosRecorrentes: topRecorrentes(melhoriaCount),
    };
  }

  private async invoicesData(): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { subscription: { include: { plan: true } } },
    });

    return {
      headers: ["id", "plano", "valor", "status", "metodo", "vencimento", "pagoEm", "criadaEm"],
      rows: invoices.map((inv) => [
        inv.id,
        csvEscape(inv.subscription.plan.nome),
        inv.valor.toString(),
        inv.status,
        inv.metodo ?? "",
        inv.vencimento.toISOString(),
        inv.pagoEm?.toISOString() ?? "",
        inv.createdAt.toISOString(),
      ]),
    };
  }

  async exportInvoicesCsv(): Promise<string> {
    const { headers, rows } = await this.invoicesData();
    return toCsv(headers, rows);
  }

  async exportInvoicesXlsx(): Promise<Buffer> {
    const { headers, rows } = await this.invoicesData();
    return toXlsx("Faturas", headers, rows);
  }

  async exportInvoicesPdf(): Promise<Buffer> {
    const { headers, rows } = await this.invoicesData();
    return toPdf("Faturas", headers, rows);
  }

  private async opportunitiesData(): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const opportunities = await this.prisma.opportunity.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { contact: { select: { nome: true } }, stage: { select: { nome: true } } },
    });

    return {
      headers: ["id", "contato", "etapa", "valor", "status", "criadaEm"],
      rows: opportunities.map((opp) => [
        opp.id,
        csvEscape(opp.contact.nome),
        csvEscape(opp.stage.nome),
        opp.valor?.toString() ?? "",
        opp.status,
        opp.createdAt.toISOString(),
      ]),
    };
  }

  async exportOpportunitiesCsv(): Promise<string> {
    const { headers, rows } = await this.opportunitiesData();
    return toCsv(headers, rows);
  }

  async exportOpportunitiesXlsx(): Promise<Buffer> {
    const { headers, rows } = await this.opportunitiesData();
    return toXlsx("Oportunidades", headers, rows);
  }

  async exportOpportunitiesPdf(): Promise<Buffer> {
    const { headers, rows } = await this.opportunitiesData();
    return toPdf("Oportunidades", headers, rows);
  }

  private async contactsData(): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const contacts = await this.prisma.contact.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { responsavel: { select: { nome: true } }, origemRef: { select: { nome: true } }, phones: true },
    });

    return {
      headers: ["id", "nome", "sobrenome", "documento", "telefone", "whatsapp", "outrosTelefones", "email", "origem", "campanha", "responsavel", "criadoEm"],
      rows: contacts.map((c) => [
        c.id,
        csvEscape(c.nome),
        csvEscape(c.sobrenome ?? ""),
        c.cpf ?? c.cnpj ?? "",
        c.telefone ?? "",
        c.whatsapp ?? "",
        csvEscape(c.phones.map((p) => `${p.tipo}: ${p.numero}`).join("; ")),
        c.email ?? "",
        csvEscape(c.origemRef?.nome ?? c.origem ?? ""),
        csvEscape(c.campanha ?? ""),
        csvEscape(c.responsavel?.nome ?? ""),
        c.createdAt.toISOString(),
      ]),
    };
  }

  async exportContactsCsv(): Promise<string> {
    const { headers, rows } = await this.contactsData();
    return toCsv(headers, rows);
  }

  async exportContactsXlsx(): Promise<Buffer> {
    const { headers, rows } = await this.contactsData();
    return toXlsx("Contatos", headers, rows);
  }

  async exportContactsPdf(): Promise<Buffer> {
    const { headers, rows } = await this.contactsData();
    return toPdf("Contatos", headers, rows);
  }

  private async messagesData(dto: DateRangeDto): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);
    const messages = await this.prisma.message.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: { conversation: { select: { contatoNumero: true } } },
    });

    return {
      headers: ["id", "conversa", "contatoNumero", "direcao", "tipo", "statusEntrega", "criadaEm"],
      rows: messages.map((m) => [
        m.id,
        m.conversationId,
        m.conversation.contatoNumero,
        m.direction,
        m.tipo,
        m.statusEntrega ?? "",
        m.createdAt.toISOString(),
      ]),
    };
  }

  async exportMessagesCsv(dto: DateRangeDto): Promise<string> {
    const { headers, rows } = await this.messagesData(dto);
    return toCsv(headers, rows);
  }

  async exportMessagesXlsx(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.messagesData(dto);
    return toXlsx("Mensagens", headers, rows);
  }

  async exportMessagesPdf(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.messagesData(dto);
    return toPdf("Mensagens", headers, rows);
  }

  private async conversationsData(dto: DateRangeDto): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);
    const conversations = await this.prisma.conversation.findMany({
      where: { tenantId, deletedAt: null, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: { queue: { select: { nome: true } }, responsavel: { select: { nome: true } } },
    });

    return {
      headers: ["id", "contatoNumero", "fila", "responsavel", "status", "prioridade", "criadaEm", "ultimaMensagemEm"],
      rows: conversations.map((c) => [
        c.id,
        c.contatoNumero,
        csvEscape(c.queue?.nome ?? ""),
        csvEscape(c.responsavel?.nome ?? ""),
        c.status,
        c.prioridade,
        c.createdAt.toISOString(),
        c.lastMessageAt?.toISOString() ?? "",
      ]),
    };
  }

  async exportConversationsCsv(dto: DateRangeDto): Promise<string> {
    const { headers, rows } = await this.conversationsData(dto);
    return toCsv(headers, rows);
  }

  async exportConversationsXlsx(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.conversationsData(dto);
    return toXlsx("Conversas", headers, rows);
  }

  async exportConversationsPdf(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.conversationsData(dto);
    return toPdf("Conversas", headers, rows);
  }

  private async chatbotExecutionsData(dto: DateRangeDto): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);
    const executions = await this.prisma.chatbotExecution.findMany({
      where: { tenantId, startedAt: { gte: from, lte: to } },
      orderBy: { startedAt: "desc" },
      include: { chatbotFlow: { select: { nome: true } } },
    });

    return {
      headers: ["id", "fluxo", "versao", "status", "iniciadaEm", "finalizadaEm"],
      rows: executions.map((e) => [
        e.id,
        csvEscape(e.chatbotFlow.nome),
        e.versao.toString(),
        e.status,
        e.startedAt.toISOString(),
        e.finishedAt?.toISOString() ?? "",
      ]),
    };
  }

  async exportChatbotExecutionsCsv(dto: DateRangeDto): Promise<string> {
    const { headers, rows } = await this.chatbotExecutionsData(dto);
    return toCsv(headers, rows);
  }

  async exportChatbotExecutionsXlsx(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.chatbotExecutionsData(dto);
    return toXlsx("Execucoes Chatbot", headers, rows);
  }

  async exportChatbotExecutionsPdf(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.chatbotExecutionsData(dto);
    return toPdf("Execucoes Chatbot", headers, rows);
  }

  private async automationExecutionsData(dto: DateRangeDto): Promise<TabularData> {
    const tenantId = requireCurrentTenantId();
    const { from, to } = resolveDateRange(dto);
    const executions = await this.prisma.automationExecution.findMany({
      where: { tenantId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "desc" },
      include: { automation: { select: { nome: true } } },
    });

    return {
      headers: ["id", "automacao", "gatilhoDisparado", "tentativas", "status", "erro", "criadaEm"],
      rows: executions.map((e) => [
        e.id,
        csvEscape(e.automation.nome),
        e.gatilhoDisparado,
        e.tentativas.toString(),
        e.status,
        csvEscape(e.erro ?? ""),
        e.createdAt.toISOString(),
      ]),
    };
  }

  async exportAutomationExecutionsCsv(dto: DateRangeDto): Promise<string> {
    const { headers, rows } = await this.automationExecutionsData(dto);
    return toCsv(headers, rows);
  }

  async exportAutomationExecutionsXlsx(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.automationExecutionsData(dto);
    return toXlsx("Execucoes Automacao", headers, rows);
  }

  async exportAutomationExecutionsPdf(dto: DateRangeDto): Promise<Buffer> {
    const { headers, rows } = await this.automationExecutionsData(dto);
    return toPdf("Execucoes Automacao", headers, rows);
  }
}
