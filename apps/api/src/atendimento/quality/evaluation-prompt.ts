export interface EvaluationResult {
  notaGeral: number;
  classificacao: string;
  criteriosAvaliados: { nome: string; nota: number; comentario: string }[];
  pontosPositivos: string[];
  pontosMelhoria: string[];
  oportunidadesPerdidas: string[];
  momentosCriticos: string[];
  sugestoes: string[];
  resumoExecutivo: string;
}

/**
 * Fase 43 (ver DEVELOPMENT_PLAN.md): critérios vêm da configuração do
 * tenant (`QualityConfigService`, peso/obrigatório por critério), não mais
 * fixos — `obrigatorios` reforça no prompt quais critérios não podem ficar
 * sem avaliação.
 */
export function buildEvaluationSystemPrompt(criterios: string[], obrigatorios: string[]): string {
  return [
    "Você é um avaliador de qualidade de atendimento comercial. Analise a transcrição de uma conversa entre um cliente e um atendente (humano ou IA) e produza uma avaliação objetiva.",
    "",
    `Critérios a avaliar (nota individual de 0 a 10 cada, um item em "criteriosAvaliados" por critério, usando exatamente o nome dado): ${criterios.join(", ")}.`,
    ...(obrigatorios.length > 0 ? [`Critérios obrigatórios — nunca deixe de avaliá-los: ${obrigatorios.join(", ")}.`] : []),
    "",
    "Baseie-se somente no que está na transcrição — nunca invente informações que não apareceram na conversa.",
    "",
    "Responda EXCLUSIVAMENTE com um JSON válido, sem nenhum texto antes ou depois, no seguinte formato:",
    JSON.stringify(
      {
        notaGeral: 0,
        classificacao: "fraco | regular | bom | excelente",
        criteriosAvaliados: [{ nome: "string", nota: 0, comentario: "string" }],
        pontosPositivos: ["string"],
        pontosMelhoria: ["string"],
        oportunidadesPerdidas: ["string"],
        momentosCriticos: ["string"],
        sugestoes: ["string"],
        resumoExecutivo: "string",
      },
      null,
      2,
    ),
  ].join("\n");
}

/** A IA às vezes envolve o JSON em ```json ... ``` apesar da instrução — extrai o bloco antes de fazer o parse. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return text;
  }
  return text.slice(start, end + 1);
}
