export interface LeadScoreThresholds {
  /** Score mínimo para "morno" (abaixo disso é "frio"). */
  morno: number;
  /** Score mínimo para "quente". */
  quente: number;
}

/** Faixas padrão do prompt mestre §4: 0-39 Frio, 40-69 Morno, 70-100 Quente. */
export const DEFAULT_LEAD_SCORE_THRESHOLDS: LeadScoreThresholds = { morno: 40, quente: 70 };

export function classifyLeadScore(score: number, thresholds: LeadScoreThresholds = DEFAULT_LEAD_SCORE_THRESHOLDS): "frio" | "morno" | "quente" {
  if (score >= thresholds.quente) return "quente";
  if (score >= thresholds.morno) return "morno";
  return "frio";
}
