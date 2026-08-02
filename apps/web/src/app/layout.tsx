import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { MenuLayoutProvider } from "@/lib/menu-layout";
import { I18nProvider } from "@/lib/i18n";

export const metadata = {
  title: "Chatbot SaaS Platform",
  description: "Atendimento, CRM, Chatbot, Automação e WhatsApp em uma plataforma só.",
};

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
              <QueryProvider>{children}</QueryProvider>
            </I18nProvider>
          </MenuLayoutProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
