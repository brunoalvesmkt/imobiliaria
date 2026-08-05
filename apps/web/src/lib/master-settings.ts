import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "./api-client";

/**
 * `GET/PATCH /master/settings` — módulo "Configurações para Empresas"
 * (documento de alterações, seção 5): configurações globais do fluxo de
 * contratação/cadastro, antes fixas no código.
 */
export interface PlatformSettings {
  id: string;
  planSelectionEnabled: boolean;
  allowMonthly: boolean;
  allowAnnual: boolean;
  showPrices: boolean;
  showTrialPeriod: boolean;
  subscribeButtonText: string;
  allowPlanChangeBeforeSignup: boolean;
  emailConfirmRepeatEnabled: boolean;
  emailConfirmCodeEnabled: boolean;
  tenantCanEditProfile: boolean;
  requireCodeOnEmailChange: boolean;
  riskTermVersion: string;
  riskTermText: string;
  moduleOrder: string[];
  tenantLogoLightUrl: string | null;
  tenantLogoDarkUrl: string | null;
  tenantLogoSizePercent: number;
  masterLogoLightUrl: string | null;
  masterLogoDarkUrl: string | null;
  masterLogoSizePercent: number;
  browserTitle: string | null;
  faviconUrl: string | null;
  updatedAt: string;
}

export type UpdatePlatformSettingsInput = Partial<Omit<PlatformSettings, "id" | "updatedAt">>;

export function useMasterSettings() {
  return useQuery({ queryKey: ["master", "settings"], queryFn: () => apiGet<PlatformSettings>("/master/settings") });
}

export function useUpdateMasterSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformSettingsInput) => apiPatch<PlatformSettings>("/master/settings", input),
    onSuccess: (settings) => {
      queryClient.setQueryData(["master", "settings"], settings);
      // Título/favicon são lidos publicamente por SiteMetadata — refletir mudança sem esperar o staleTime.
      queryClient.invalidateQueries({ queryKey: ["branding", "site"] });
    },
  });
}
