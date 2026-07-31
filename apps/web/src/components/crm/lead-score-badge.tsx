import { classifyLeadScore, useLeadScoreConfig } from "@/lib/crm";
import { useI18n } from "@/lib/i18n";
import type { DictionaryKey } from "@/lib/i18n/dictionaries/pt-BR";

type Classificacao = ReturnType<typeof classifyLeadScore>;

const CLASS_STYLES: Record<Classificacao, string> = {
  frio: "bg-blue-50 text-blue-700",
  morno: "bg-amber-50 text-amber-700",
  quente: "bg-red-50 text-red-700",
};

const CLASS_LABEL_KEYS: Record<Classificacao, DictionaryKey> = {
  frio: "crm.leadScore.frio",
  morno: "crm.leadScore.morno",
  quente: "crm.leadScore.quente",
};

export function LeadScoreBadge({ score }: { score: number }) {
  const { t } = useI18n();
  const config = useLeadScoreConfig();
  const classificacao = classifyLeadScore(score, config.data);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CLASS_STYLES[classificacao]}`}>
      {t(CLASS_LABEL_KEYS[classificacao])} · {score}
    </span>
  );
}
