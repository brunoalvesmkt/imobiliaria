import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class CreateNumberFlowDto {
  @IsUUID()
  chatbotFlowId!: string;

  @IsIn(["keyword", "any"])
  regraAtivacao!: "keyword" | "any";

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  termos?: string[];

  @IsOptional()
  @IsInt()
  prioridade?: number;
}
