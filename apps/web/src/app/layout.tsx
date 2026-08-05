import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { MenuLayoutProvider } from "@/lib/menu-layout";
import { I18nProvider } from "@/lib/i18n";
import { SiteMetadata } from "@/components/layout/site-metadata";

const DEFAULT_TITLE = "Chatbot SaaS Platform";
const DEFAULT_DESCRIPTION = "Atendimento, CRM, Chatbot, Automação e WhatsApp em uma plataforma só.";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Busca o título/favicon já no servidor (mesmo endpoint público que
 * `SiteMetadata` usa no cliente) para o `<title>` correto ir dentro do HTML
 * desde a primeira resposta — sem isso, a aba mostra brevemente
 * "Chatbot SaaS Platform" até o JS do cliente trocar via `document.title`
 * (débito registrado desde a Fase de branding, fechado aqui). Best-effort,
 * mesmo raciocínio do `middleware.ts`: se a API estiver indisponível na hora
 * do build/request, cai no título padrão em vez de quebrar a página.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/branding/site`, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { browserTitle?: string | null; faviconUrl?: string | null };
    return {
      title: data.browserTitle || DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      ...(data.faviconUrl ? { icons: { icon: data.faviconUrl } } : {}),
    };
  } catch {
    return { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION };
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <MenuLayoutProvider>
            <I18nProvider>
              <QueryProvider>
                <SiteMetadata />
                {children}
              </QueryProvider>
            </I18nProvider>
          </MenuLayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
