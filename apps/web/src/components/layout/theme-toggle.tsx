"use client";

import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
      aria-label={theme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-dim hover:bg-surface-alt"
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
