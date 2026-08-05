import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { LogoImage } from "@/components/layout/logo-image";
import { useSiteBranding } from "@/lib/branding";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  logoVariant = "tenant",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Qual logotipo de login mostrar — "tenant" (padrão, /login) ou "master" (/master/login). */
  logoVariant?: "tenant" | "master";
}) {
  const branding = useSiteBranding();
  const logo = logoVariant === "master" ? branding.data?.masterLoginLogo : branding.data?.tenantLoginLogo;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface-alt px-4 py-12">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <LogoImage
            lightUrl={logo?.logoLightUrl}
            darkUrl={logo?.logoDarkUrl}
            sizePercent={logo?.sizePercent}
            fallbackLetter={logoVariant === "master" ? "M" : "C"}
            fallbackClassName="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-lg font-bold text-white"
            loading={branding.isLoading}
          />
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="text-sm text-ink-dim">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">{children}</div>
        {footer && <div className="mt-4 text-center text-sm text-ink-dim">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-brand-600 hover:text-brand-700 hover:underline">
      {children}
    </Link>
  );
}
