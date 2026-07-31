import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import type { ZodIssue, ZodSchema } from "zod";

/**
 * Fase 39 (ver DEVELOPMENT_PLAN.md): backend passa a consumir os mesmos
 * schemas Zod de `packages/validation` que o frontend já usa para feedback
 * antecipado (Fase 31) — camada extra sobre o `class-validator` global
 * (`main.ts`/bootstrap de teste), aplicada só nos parâmetros cujo schema já
 * existe (evita reescrever toda a validação do projeto de uma vez). Recebe
 * o valor já transformado pelo `ValidationPipe` global (instância da DTO) —
 * `safeParse` funciona igual sobre um objeto plano ou uma instância de classe.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: result.error.issues.map((issue: ZodIssue) => issue.message),
      });
    }
    return value;
  }
}
