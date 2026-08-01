import { z } from "zod";
import { isValidCpfOuCnpj } from "./document";

/**
 * Validação autoritativa do `POST /auth/signup` — `AuthController` usa este
 * schema direto via `ZodValidationPipe` (não passa pelos decorators de
 * `apps/api/src/auth/dto/signup-tenant.dto.ts`, que hoje só servem de tipo).
 * Documento de alterações da plataforma, seção 3: cadastro estendido com
 * CPF/CNPJ único, responsável, telefone, WhatsApp, segmento e endereço
 * completo, todos obrigatórios; mais a seleção de plano (seção 2).
 */
export const signupTenantSchema = z
  .object({
    razaoSocial: z.string().trim().min(1, "Informe o nome ou razão social."),
    cnpj: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 11 || v.length === 14, "Informe um CPF ou CNPJ com a quantidade certa de dígitos.")
      .refine((v) => isValidCpfOuCnpj(v), "CPF ou CNPJ inválido — confira os dígitos."),
    responsavel: z.string().trim().min(1, "Informe o nome completo do responsável."),
    telefone: z.string().trim().min(1, "Informe o telefone."),
    whatsapp: z.string().trim().min(1, "Informe o WhatsApp."),
    segmentoId: z.string().uuid("Selecione o segmento da empresa."),
    endereco: z.string().trim().min(1, "Informe o endereço."),
    numero: z.string().trim().min(1, "Informe o número."),
    bairro: z.string().trim().min(1, "Informe o bairro."),
    cidade: z.string().trim().min(1, "Informe a cidade."),
    uf: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "UF deve ter 2 letras."),
    cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido — use o formato 00000-000."),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    confirmacaoEmail: z.string().trim().toLowerCase().email("E-mail inválido."),
    senha: z.string().min(10, "A senha deve ter ao menos 10 caracteres."),
    confirmacaoSenha: z.string(),
    planId: z.string().uuid("Selecione um plano."),
    periodicidade: z.enum(["mensal", "anual"]),
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
