import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { MenuLayoutProvider } from "@/lib/menu-layout";
import { I18nProvider } from "@/lib/i18n";
import { SiteMetadata } from "@/components/layout/site-metadata";

const DEFAULT_TITLE = "Plataforma Imobiliária";
const DEFAULT_DESCRIPTION = "Atendimento, CRM, Chatbot, Automação e WhatsApp em uma plataforma só.";
// Ver comentário equivalente em middleware.ts: busca só do servidor, usa
// `API_URL` (rede interna do Docker em produção) em vez de `NEXT_PUBLIC_API_URL`
// (domínio público) — essa era a causa do título da aba às vezes cair no
// padrão em vez do personalizado (fetch server-to-server pelo domínio público
// falhando silenciosamente dentro do container).
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Busca o título/favicon já no servidor (mesmo endpoint público que
 * `SiteMetadata` usa no cliente) para o `<title>` correto ir dentro do HTML
 * desde a primeira resposta — sem isso, a aba mostra brevemente
 * "Plataforma Imobiliária" até o JS do cliente trocar via `document.title`
 * (débito registrado desde a Fase de branding, fechado aqui). Best-effort,
 * mesmo raciocínio do `middleware.ts`: se a API estiver indisponível na hora
 * do build/request, cai no título padrão em vez de quebrar a página.
 *
 * `revalidate` (não `no-store`): o Next re-resolve os metadados do layout
 * raiz em toda navegação, inclusive as internas do SPA — com `no-store`,
 * cada clique refazia essa busca do zero, e o favicon piscava para o padrão
 * enquanto a resposta não chegava. Com cache de 60s, navegações repetidas
 * pegam o resultado já resolvido na hora; a marca do Master raramente muda,
 * então até um minuto de defasagem é aceitável.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/branding/site`, { next: { revalidate: 60 } });
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
