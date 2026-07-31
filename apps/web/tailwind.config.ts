import type { Config } from "tailwindcss";

function withOpacity(variable: string) {
  return `rgb(var(${variable}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: withOpacity("--brand-50"),
          100: withOpacity("--brand-100"),
          200: withOpacity("--brand-200"),
          300: withOpacity("--brand-300"),
          400: withOpacity("--brand-400"),
          500: withOpacity("--brand-500"),
          600: withOpacity("--brand-600"),
          700: withOpacity("--brand-700"),
          800: withOpacity("--brand-800"),
          900: withOpacity("--brand-900"),
        },
        ink: {
          DEFAULT: withOpacity("--ink"),
          dim: withOpacity("--ink-dim"),
          faint: withOpacity("--ink-faint"),
        },
        surface: {
          DEFAULT: withOpacity("--surface"),
          alt: withOpacity("--surface-alt"),
          muted: withOpacity("--surface-muted"),
        },
        line: withOpacity("--line"),
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Cascadia Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
