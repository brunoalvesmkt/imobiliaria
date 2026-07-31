import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from "class-validator";

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsNumber()
  @Min(0)
  preco!: number;

  @IsIn(["mensal", "anual"])
  recorrencia!: "mensal" | "anual";

  /** Módulos comerciais incluídos, ex.: ["crm", "whatsapp", "chatbot", "automacao"] — ver MODULE_DEPENDENCIES.md. */
  @IsArray()
  @IsString({ each: true })
  modulos!: string[];

  /** Limites do plano, ex.: { "usuarios": 10, "numerosWhatsapp": 1, "armazenamentoMb": 500 }. */
  @IsObject()
  limites!: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  iaIncluida?: boolean;

  @IsOptional()
  @IsBoolean()
  apiOficial?: boolean;
}
