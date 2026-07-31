import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsBoolean, IsNumber, IsString, Max, Min, MinLength, ValidateNested } from "class-validator";

export class QualityCriterionDto {
  @IsString()
  @MinLength(1)
  nome!: string;

  @IsNumber()
  @Min(0)
  peso!: number;

  @IsBoolean()
  obrigatorio!: boolean;
}

export class UpdateQualityConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QualityCriterionDto)
  criterios!: QualityCriterionDto[];

  @IsNumber()
  @Min(0)
  @Max(10)
  notaMinima!: number;
}
