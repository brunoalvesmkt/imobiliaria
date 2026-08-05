import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

/** `GET /branding/tenant` e `GET /branding/master` — logo configurado pelo Master, lido por qualquer usuário autenticado do respectivo painel. */
export interface BrandingConfig {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  sizePercent: number;
}

export function useTenantBranding(enabled = true) {
  return useQuery({
    queryKey: ["branding", "tenant"],
    queryFn: () => apiGet<BrandingConfig>("/branding/tenant"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMasterBranding(enabled = true) {
  return useQuery({
    queryKey: ["branding", "master"],
    queryFn: () => apiGet<BrandingConfig>("/branding/master"),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** `GET /branding/site` — sem autenticação, título da aba e favicon aparecem inclusive na tela de login. */
export interface SiteBranding {
  browserTitle: string | null;
  faviconUrl: string | null;
}

export function useSiteBranding() {
  return useQuery({
    queryKey: ["branding", "site"],
    queryFn: () => apiGet<SiteBranding>("/branding/site"),
    staleTime: 5 * 60 * 1000,
  });
}
