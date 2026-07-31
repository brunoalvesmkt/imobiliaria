"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, isSupportedLocale, matchBrowserLocale, type Locale } from "./locales";
import ptBR, { type DictionaryKey } from "./dictionaries/pt-BR";
import ptPT from "./dictionaries/pt-PT";
import en from "./dictionaries/en";
import es from "./dictionaries/es";

export type { Locale } from "./locales";
export { SUPPORTED_LOCALES, LOCALE_LABELS } from "./locales";

const DICTIONARIES: Record<Locale, Record<DictionaryKey, string>> = {
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  en,
  es,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    setLocaleState(matchBrowserLocale(navigator.languages ?? [navigator.language]));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const t = useMemo(() => {
    const dictionary = DICTIONARIES[locale];
    // pt-BR é sempre a fonte completa — se uma chave faltar num dicionário
    // novo (ex.: idioma recém-adicionado ainda incompleto), cai para pt-BR
    // em vez de mostrar a chave crua na tela.
    return (key: DictionaryKey): string => dictionary[key] ?? ptBR[key] ?? key;
  }, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n deve ser usado dentro de <I18nProvider>.");
  return ctx;
}
