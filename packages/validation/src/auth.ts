import { z } from "zod";

/**
 * Espelha as regras de `apps/api/src/auth/dto/signup-tenant.dto.ts` — a
 * validação autoritativa continua sendo a do backend (class-validator), este
 * schema serve para o frontend dar feedback antes de enviar a requisição
 * (Fase 31, ver DEVELOPMENT_PLAN.md — início de `packages/validation`).
 */
export const signupTenantSchema = z
  .object({
    razaoSocial: z.string().trim().min(1, "Informe a razão social."),
    cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos numéricos."),
    responsavel: z.string().trim().min(1, "Informe o responsável."),
    endereco: z.string().trim().optional(),
    telefone: z.string().trim().optional(),
    whatsapp: z.string().trim().optional(),
    email: z.string().email("E-mail inválido."),
    confirmacaoEmail: z.string().email("E-mail inválido."),
    senha: z.string().min(10, "A senha deve ter ao menos 10 caracteres."),
    confirmacaoSenha: z.string(),
    affiliateLinkCode: z.string().trim().optional(),
  })
  .refine((data) => data.email === data.confirmacaoEmail, {
    message: "A confirmação de e-mail deve ser igual ao e-mail.",
    path: ["confirmacaoEmail"],
  })
  .refine((data) => data.senha === data.confirmacaoSenha, {
    message: "A confirmação de senha deve ser igual à senha.",
    path: ["confirmacaoSenha"],
  });

export type SignupTenantInput = z.infer<typeof signupTenantSchema>;

/** Espelha `apps/api/src/auth/dto/login.dto.ts`. */
export const loginSchema = z.object({
  email: z.string().email("E-mail inválido."),
  senha: z.string().min(1, "Informe a senha."),
});

export type LoginInput = z.infer<typeof loginSchema>;
