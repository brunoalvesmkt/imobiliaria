import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api-client";

/**
 * Consome `GET /public/catalog/*` (apps/api/src/public-catalog) — rotas sem
 * autenticação usadas pela página pública "Escolha seu plano" e pelo
 * formulário de cadastro, antes de existir qualquer sessão. Documento de
 * alterações da plataforma, seções 2 e 3.
 */
export interface PublicPlan {
  id: string;
  nome: string;
  descricao: string | null;
  preco: string;
  precoAnual: string | null;
  funcionalidades: unknown;
  diasTeste: number;
  destaque: boolean;
  ordem: number;
}

export interface PublicSegment {
  id: string;
  nome: string;
  ordem: number;
}

export function usePublicPlans() {
  return useQuery({
    queryKey: ["public-catalog", "plans"],
    queryFn: () => apiGet<PublicPlan[]>("/public/catalog/plans"),
    staleTime: 60_000,
  });
}

export function usePublicSegments() {
  return useQuery({
    queryKey: ["public-catalog", "segments"],
    queryFn: () => apiGet<PublicSegment[]>("/public/catalog/segments"),
    staleTime: 60_000,
  });
}

export function planFeatureList(funcionalidades: unknown): string[] {
  if (!Array.isArray(funcionalidades)) return [];
  return funcionalidades.filter((f): f is string => typeof f === "string");
}
