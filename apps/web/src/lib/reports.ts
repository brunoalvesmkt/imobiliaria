import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

export interface DashboardData {
  modulosAtivos: string[];
  crm?: { totalContacts: number; openOpportunities: number; wonOpportunitiesThisMonth: number; pendingTasks: number };
  whatsapp?: { connectedNumbers: number; messagesLast7Days: number };
  atendimento?: { openConversations: number; conversationsWaitingQueue: number };
  chatbot?: { activeFlows: number; executionsLast7Days: number };
  automacao?: { activeAutomations: number; executionsLast7Days: number; deadLetterCount: number };
  financeiro: { subscriptionStatus: string; plano: string | null; overdueInvoicesCount: number };
}

export function useDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: () => apiGet<DashboardData>("/reports/dashboard"),
    enabled,
  });
}

export interface DateRange {
  from?: string;
  to?: string;
}

interface Periodo {
  from: string;
  to: string;
}

export interface CrmReport {
  periodo: Periodo;
  contactsCreated: number;
  opportunitiesByStage: { stageId: string; nome: string; count: number }[];
  opportunitiesWon: number;
  opportunitiesLost: number;
  opportunitiesWonValue: number;
  opportunitiesLostValue: number;
  conversionRate: number;
  tasksPending: number;
  tasksOverdue: number;
}

export interface WhatsappReport {
  periodo: Periodo;
  messagesSent: number;
  messagesReceived: number;
  messagesFailed: number;
  numbersByStatus: { status: string; count: number }[];
}

export interface AtendimentoReport {
  periodo: Periodo;
  conversationsByStatus: { status: string; count: number }[];
  conversationsByQueue: { queueId: string | null; nome: string; count: number }[];
}

export interface ChatbotReport {
  periodo: Periodo;
  executionsByStatus: { status: string; count: number }[];
  completionRate: number;
}

export interface AutomacaoReport {
  periodo: Periodo;
  executionsByStatus: { status: string; count: number }[];
  deadLetterCount: number;
}

export interface FinanceiroReport {
  periodo: Periodo;
  invoicesByStatus: { status: string; count: number; total: string }[];
  mrr: string;
}

export interface QualidadeReport {
  periodo: Periodo;
  totalAvaliacoes: number;
  notaMedia: number;
  mediaPorAtendente: { id: string; nome: string; media: number; avaliacoes: number }[];
  evolucaoMensal: { mes: string; media: number; avaliacoes: number }[];
  pontosFortesRecorrentes: { texto: string; count: number }[];
  pontosFracosRecorrentes: { texto: string; count: number }[];
}

function toQueryString(range: DateRange): string {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function useModuleReport<T>(module: string, range: DateRange) {
  return useQuery({
    queryKey: ["reports", module, range.from ?? "", range.to ?? ""],
    queryFn: () => apiGet<T>(`/reports/${module}${toQueryString(range)}`),
  });
}

export function useCrmReport(range: DateRange) {
  return useModuleReport<CrmReport>("crm", range);
}
export function useWhatsappReport(range: DateRange) {
  return useModuleReport<WhatsappReport>("whatsapp", range);
}
export function useAtendimentoReport(range: DateRange) {
  return useModuleReport<AtendimentoReport>("atendimento", range);
}
export function useChatbotReport(range: DateRange) {
  return useModuleReport<ChatbotReport>("chatbot", range);
}
export function useAutomacaoReport(range: DateRange) {
  return useModuleReport<AutomacaoReport>("automacao", range);
}
export function useFinanceiroReport(range: DateRange) {
  return useModuleReport<FinanceiroReport>("financeiro", range);
}
export function useQualidadeReport(range: DateRange) {
  return useModuleReport<QualidadeReport>("qualidade", range);
}
