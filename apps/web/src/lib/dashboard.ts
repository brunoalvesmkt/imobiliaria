import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "./api-client";

export const PERIOD_PRESETS = ["hoje", "ontem", "7dias", "30dias", "esteMes", "esteAno", "vitalicio", "personalizado"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const COMPARE_MODES = [
  "nenhum",
  "periodoAnterior",
  "ontem",
  "7diasAnteriores",
  "30diasAnteriores",
  "mesAnterior",
  "anoAnterior",
  "personalizado",
] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

export interface PeriodFilterState {
  preset: PeriodPreset;
  from?: string;
  to?: string;
  compare: CompareMode;
  compareFrom?: string;
  compareTo?: string;
}

interface Delta {
  valor: number;
  percentual: number | null;
}

interface CrmSection {
  atual: {
    contactsCreated: number;
    opportunitiesByStage: { stageId: string; nome: string; count: number }[];
    opportunitiesWon: number;
    opportunitiesLost: number;
    opportunitiesWonValue: number;
    opportunitiesLostValue: number;
    conversionRate: number;
    tasksPending: number;
    tasksOverdue: number;
  };
  anterior: CrmSection["atual"] | null;
  deltas: {
    contactsCreated: Delta;
    opportunitiesWon: Delta;
    opportunitiesWonValue: Delta;
    conversionRate: Delta;
  };
}

interface AtendimentoSection {
  atual: {
    conversationsByStatus: { status: string; count: number }[];
    conversationsByQueue: { queueId: string | null; nome: string; count: number }[];
  };
  anterior: AtendimentoSection["atual"] | null;
  deltas: {
    total: Delta;
    fechadas: Delta;
  };
}

export interface DashboardAction {
  id: string;
  titulo: string;
  descricao: string;
  quantidade: number;
  severidade: "critica" | "alta" | "media" | "informativa";
  modulo: string;
  link: string;
}

export interface DashboardSummary {
  modulosAtivos: string[];
  periodo: { from: string; to: string; label: string };
  comparacao: { from: string; to: string; label: string | null } | null;
  crm: CrmSection | null;
  atendimento: AtendimentoSection | null;
  operacional: {
    atendentesOnline: number;
    atendentesOffline?: number;
    conversasAguardando?: number;
    filasAbertas?: number;
    oportunidadesSemResponsavel?: number;
    tarefasVencidas?: number;
  };
  acoes: DashboardAction[];
}

function buildQuery(filter: PeriodFilterState): string {
  const params = new URLSearchParams({ preset: filter.preset, compare: filter.compare });
  if (filter.preset === "personalizado" && filter.from && filter.to) {
    params.set("from", filter.from);
    params.set("to", filter.to);
  }
  if (filter.compare === "personalizado" && filter.compareFrom && filter.compareTo) {
    params.set("compareFrom", filter.compareFrom);
    params.set("compareTo", filter.compareTo);
  }
  return params.toString();
}

export function useDashboardSummary(filter: PeriodFilterState, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "summary", filter],
    queryFn: () => apiGet<DashboardSummary>(`/dashboard/summary?${buildQuery(filter)}`),
    enabled,
    // Bloco operacional é tempo real — atualiza sozinho em segundo plano sem exigir F5.
    refetchInterval: 60_000,
  });
}

export interface AlertConfig {
  queueWaitMinutes: number;
  opportunityStagnantDays: number;
  proposalNoResponseDays: number;
  taskOverdueEnabled: boolean;
}

export function useAlertConfig(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "alert-config"],
    queryFn: () => apiGet<AlertConfig>("/dashboard/alert-config"),
    enabled,
  });
}

export function useUpdateAlertConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AlertConfig>) => apiPatch<AlertConfig>("/dashboard/alert-config", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
