const DIACRITICS_PATTERN = new RegExp("[̀-ͯ]", "g");
const WHITESPACE_PATTERN = new RegExp("\\s+", "g");

/**
 * Normaliza texto para comparacao de gatilhos do chatbot (palavra/frase que ativa um fluxo):
 * minusculas, sem acento, espacos colapsados e sem espaco nas pontas. Numeros sao preservados
 * (fazem parte do termo quando configurados, ex.: "segunda via" continua igual, "plano 2026"
 * mantem o "2026").
 */
export function normalizeTriggerText(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .trim()
    .replace(WHITESPACE_PATTERN, " ");
}
