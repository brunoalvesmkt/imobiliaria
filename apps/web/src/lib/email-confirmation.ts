import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "./api-client";

/**
 * `POST /tenants/me/email/confirm` e `/resend-code` — confirmação do
 * e-mail da empresa no cadastro (documento de alterações, seção 4). Ambas
 * as rotas ficam liberadas em `TenantAuthGuard` mesmo com sessão ainda não
 * confirmada (ver EMAIL_CONFIRMATION_ALLOWLIST no backend).
 */
export function useConfirmEmailCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (codigo: string) => {
      const result = await apiPost<{ status: "ok" }>("/tenants/me/email/confirm", { codigo });
      // O access token emitido no cadastro carrega `emailConfirmed: false`
      // (ver TenantAuthGuard) — sem renovar aqui, ele continuaria bloqueando
      // o painel pelos próximos ~15min até expirar sozinho.
      await apiPost("/auth/tenant/refresh");
      return result;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}

export function useResendEmailConfirmationCode() {
  return useMutation({
    mutationFn: () => apiPost<{ status: "ok" }>("/tenants/me/email/resend-code"),
  });
}
