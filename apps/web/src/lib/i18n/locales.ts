export const SUPPORTED_LOCALES = ["pt-BR", "pt-PT", "en", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português (Brasil)",
  "pt-PT": "Português (Portugal)",
  en: "English",
  es: "Español",
};

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Tenta casar o idioma do navegador com um locale suportado (ex.: "pt" cai em pt-BR, o padrão). */
export function matchBrowserLocale(browserLanguages: readonly string[]): Locale {
  for (const lang of browserLanguages) {
    if (isSupportedLocale(lang)) return lang;
  }
  for (const lang of browserLanguages) {
    const prefix = lang.split("-")[0];
    const match = SUPPORTED_LOCALES.find((l) => l.split("-")[0] === prefix);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
