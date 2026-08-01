import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "./api-client";

/** Segurança > Senha / Verificação em duas etapas (documento de alterações, item 8). */
export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: (input: { senhaAtual: string; novaSenha: string }) => apiPost<{ status: "ok" }>("/tenant-users/me/password", input),
  });
}

export function useSetTwoFactor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => apiPost<{ status: "ok"; twoFactorEnabled: boolean }>("/tenant-users/me/two-factor", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant-users", "me"] }),
  });
}
