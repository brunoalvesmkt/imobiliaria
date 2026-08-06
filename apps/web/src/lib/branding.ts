import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

/** `GET /branding/tenant` e `GET /branding/master` — logo configurado pelo Master, lido por qualquer usuário autenticado do respectivo painel. */
export interface BrandingConfig {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  sizePercent: number;
}

export interface AnnouncementConfig {
  enabled: boolean;
  text: string | null;
  linkUrl: string | null;
  linkText: string | null;
  bgColor: string | null;
  textColor: string | null;
  align: "left" | "center" | "right";
  bold: boolean;
  buttonBold: boolean;
  buttonColor: string | null;
  buttonTextColor: string | null;
  buttonShape: "rounded" | "square";
  dismissMode: "session" | "always";
}

// A política padrão de retry do QueryProvider não tenta de novo em 401/403 —
// certo para buscas que sinalizam se a sessão é válida, mas essas duas rodam
// só depois que o usuário já está autenticado (dentro do painel), então um
// 401/403 pontual aqui é mais provável ser uma oscilação passageira (ex.:
// rotação do token em andamento) do que sessão realmente inválida. Sem
// insistir, uma falha isolada deixava a logo presa no fallback de letra até
// um F5 manual.
const BRANDING_RETRY = 3;

export function useTenantBranding(enabled = true) {
  return useQuery({
    queryKey: ["branding", "tenant"],
    queryFn: () => apiGet<BrandingConfig & { announcement: AnnouncementConfig }>("/branding/tenant"),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: BRANDING_RETRY,
  });
}

export function useMasterBranding(enabled = true) {
  return useQuery({
    queryKey: ["branding", "master"],
    queryFn: () => apiGet<BrandingConfig>("/branding/master"),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: BRANDING_RETRY,
  });
}

/** `GET /branding/site` — sem autenticação, título da aba/favicon/logos das telas de login aparecem antes de qualquer login. */
export interface SiteBranding {
  browserTitle: string | null;
  faviconUrl: string | null;
  tenantLoginLogo: BrandingConfig;
  masterLoginLogo: BrandingConfig;
}

export function useSiteBranding(initialData?: SiteBranding) {
  return useQuery({
    queryKey: ["branding", "site"],
    queryFn: () => apiGet<SiteBranding>("/branding/site"),
    staleTime: 5 * 60 * 1000,
    ...(initialData ? { initialData } : {}),
  });
}
