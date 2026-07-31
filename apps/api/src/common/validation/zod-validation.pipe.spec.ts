import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { createCrmTaskSchema, createOpportunitySchema, loginSchema } from "@chatbot-saas/validation";
import { ZodValidationPipe } from "./zod-validation.pipe";

/**
 * Fase 39 (ver DEVELOPMENT_PLAN.md): unidade da pipe que conecta os
 * controllers aos schemas Zod de `packages/validation`. Teste de unidade
 * (não integração HTTP) porque o `ValidationPipe` global do class-validator
 * já rejeita, antes de chegar à pipe de parâmetro, qualquer payload que
 * também violaria o schema Zod espelhado — a única forma confiável de
 * provar que esta pipe especificamente funciona é chamar `transform()`
 * diretamente.
 */
describe("ZodValidationPipe", () => {
  const schema = z.object({
    email: z.string().email("E-mail inválido."),
    idade: z.number().min(18, "Deve ser maior de idade."),
  });

  it("deixa passar um valor válido sem alterá-lo", () => {
    const pipe = new ZodValidationPipe(schema);
    const value = { email: "a@b.com", idade: 30 };
    expect(pipe.transform(value)).toBe(value);
  });

  it("rejeita com BadRequestException e a mensagem do schema quando o valor é inválido", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ email: "não-é-email", idade: 10 });
      throw new Error("deveria ter lançado BadRequestException");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as { message: string[] };
      expect(response.message).toEqual(expect.arrayContaining(["E-mail inválido.", "Deve ser maior de idade."]));
    }
  });

  /**
   * Fase 45 (ver DEVELOPMENT_PLAN.md): loginSchema passou a ser reaproveitado
   * também por `MasterAuthController`/`AffiliateAuthController` (mesma
   * `LoginDto`, mesma regra), e dois schemas novos (oportunidade, tarefa do
   * CRM) foram conectados aos respectivos controllers.
   */
  it("loginSchema (reaproveitado por master/afiliado) aceita email+senha válidos e rejeita e-mail inválido", () => {
    const pipe = new ZodValidationPipe(loginSchema);
    expect(pipe.transform({ email: "a@b.com", senha: "x" })).toEqual({ email: "a@b.com", senha: "x" });
    expect(() => pipe.transform({ email: "invalido", senha: "x" })).toThrow(BadRequestException);
  });

  it("createOpportunitySchema aceita payload válido e rejeita contactId que não é UUID", () => {
    const pipe = new ZodValidationPipe(createOpportunitySchema);
    const valid = { contactId: "11111111-1111-1111-1111-111111111111", funnelId: "22222222-2222-2222-2222-222222222222", stageId: "33333333-3333-3333-3333-333333333333" };
    expect(pipe.transform(valid)).toEqual(valid);
    expect(() => pipe.transform({ ...valid, contactId: "nao-e-uuid" })).toThrow(BadRequestException);
  });

  it("createCrmTaskSchema rejeita tipo de tarefa desconhecido", () => {
    const pipe = new ZodValidationPipe(createCrmTaskSchema);
    const valid = { contactId: "11111111-1111-1111-1111-111111111111", tipo: "retorno", titulo: "Ligar", dataHora: "2026-01-01T10:00:00.000Z" };
    expect(pipe.transform(valid)).toEqual(valid);
    expect(() => pipe.transform({ ...valid, tipo: "tipo_inexistente" })).toThrow(BadRequestException);
  });
});
