export interface QualityCriterionConfig {
  nome: string;
  peso: number;
  obrigatorio: boolean;
}

export interface QualityConfig {
  criterios: QualityCriterionConfig[];
  notaMinima: number;
}

/** Critérios padrão do prompt mestre §12, peso igual, nenhum obrigatório, nota mínima 6. */
export const DEFAULT_QUALITY_CONFIG: QualityConfig = {
  criterios: [
    "Cordialidade",
    "Clareza",
    "Rapidez",
    "Conhecimento",
    "Qualificação",
    "Investigação da necessidade",
    "Argumentação",
    "Personalização",
    "Tratamento de objeções",
    "Condução para o próximo passo",
    "Tentativa de fechamento",
    "Organização da conversa",
    "Postura profissional",
  ].map((nome) => ({ nome, peso: 1, obrigatorio: false })),
  notaMinima: 6,
};
