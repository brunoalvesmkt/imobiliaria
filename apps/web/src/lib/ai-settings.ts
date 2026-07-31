import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch } from "./api-client";

export type AiProviderName = "anthropic" | "openai" | "google";

export interface AiProviderAccess {
  provider: AiProviderName;
  hasOwnKey: boolean;
  platformKeyConfigured: boolean;
  usable: boolean;
}

export interface AiAccess {
  enabled: boolean;
  allowByok: boolean;
  allowPlatformKey: boolean;
  providers: AiProviderAccess[];
}

const QUERY_KEY = ["ai", "access"];

export function useAiAccess() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: () => apiGet<AiAccess>("/ai/access") });
}

export function useSaveAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: AiProviderName; apiKey: string }) =>
      apiPatch<{ provider: string; saved: boolean }>(`/ai/credentials/${provider}`, { apiKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProviderName) => apiDelete<{ provider: string; deleted: boolean }>(`/ai/credentials/${provider}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// -- Chaves da própria plataforma (Master), Fase 30 -----------------------

export interface PlatformAiKeyStatus {
  provider: AiProviderName;
  hasKey: boolean;
  source: "database" | "env" | "none";
}

const PLATFORM_QUERY_KEY = ["master-ai", "platform-keys"];

export function usePlatformAiKeys() {
  return useQuery({ queryKey: PLATFORM_QUERY_KEY, queryFn: () => apiGet<PlatformAiKeyStatus[]>("/master/ai/platform-keys") });
}

export function useSavePlatformAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: AiProviderName; apiKey: string }) =>
      apiPatch<{ provider: string; saved: boolean }>(`/master/ai/platform-keys/${provider}`, { apiKey }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEY }),
  });
}

export function useDeletePlatformAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProviderName) =>
      apiDelete<{ provider: string; deleted: boolean }>(`/master/ai/platform-keys/${provider}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEY }),
  });
}
