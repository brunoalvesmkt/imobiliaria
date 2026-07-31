"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Script inline (roda antes da hidratação, via `next/script` com
 * `beforeInteractive` no layout) que aplica a classe `dark` no `<html>`
 * antes da primeira pintura — sem isso, a página piscaria no tema errado
 * por uma fração de segundo (flash of unstyled theme).
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "dark" || stored === "light" ? stored : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve ser usado dentro de <ThemeProvider>.");
  return ctx;
}
