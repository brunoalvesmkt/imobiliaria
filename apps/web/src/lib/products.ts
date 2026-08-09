import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "./api-client";

export interface Product {
  id: string;
  tenantId: string;
  nome: string;
  tipo: "produto" | "servico";
  descricaoCurta: string | null;
  preco: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useProducts(tipo?: "produto" | "servico") {
  return useQuery({
    queryKey: ["crm", "products", tipo ?? "all"],
    queryFn: () => apiGet<Product[]>(`/crm/products${tipo ? `?tipo=${tipo}` : ""}`),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { nome: string; tipo: "produto" | "servico"; descricaoCurta?: string; preco: number }) =>
      apiPost<Product>("/crm/products", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "products"] }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      nome?: string;
      tipo?: "produto" | "servico";
      descricaoCurta?: string;
      preco?: number;
      ativo?: boolean;
    }) => apiPatch<Product>(`/crm/products/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm", "products"] }),
  });
}
