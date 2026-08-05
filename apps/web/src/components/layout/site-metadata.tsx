"use client";

import { useEffect } from "react";
import { useSiteBranding } from "@/lib/branding";

/**
 * Aplica o título da aba e o favicon configurados pelo Master (`PlatformSettings`)
 * assim que carregam — o layout raiz (`app/layout.tsx`) é estático (sem fetch),
 * então esse ajuste acontece no cliente, depois da primeira pintura. Sem
 * configuração, o `<title>`/favicon padrão do `metadata` estático continuam valendo.
 */
export function SiteMetadata() {
  const branding = useSiteBranding();

  useEffect(() => {
    if (branding.data?.browserTitle) {
      document.title = branding.data.browserTitle;
    }
  }, [branding.data?.browserTitle]);

  useEffect(() => {
    if (!branding.data?.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.data.faviconUrl;
  }, [branding.data?.faviconUrl]);

  return null;
}
