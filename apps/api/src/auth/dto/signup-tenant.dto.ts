/**
 * Tipo do corpo de `POST /auth/signup` depois de passar pelo
 * `ZodValidationPipe(signupTenantSchema)` (ver `AuthController`) — a
 * validação de verdade é a do schema Zod em `@chatbot-saas/validation`;
 * esta classe existe só para dar tipo ao `dto` no controller/service.
 */
export class SignupTenantDto {
  razaoSocial!: string;
  cnpj!: string;
  responsavel!: string;
  telefone!: string;
  whatsapp!: string;
  segmentoId!: string;
  endereco!: string;
  numero!: string;
  bairro!: string;
  cidade!: string;
  uf!: string;
  cep!: string;
  email!: string;
  confirmacaoEmail!: string;
  senha!: string;
  confirmacaoSenha!: string;
  planId!: string;
  periodicidade!: "mensal" | "anual";
  affiliateLinkCode?: string;
}
