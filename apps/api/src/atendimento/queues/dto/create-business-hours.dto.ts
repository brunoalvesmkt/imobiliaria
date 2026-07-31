import { IsDateString, IsInt, IsOptional, IsString, Matches, Max, Min } from "class-validator";

export class CreateBusinessHoursDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "horaInicio deve estar no formato HH:mm" })
  horaInicio?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "horaFim deve estar no formato HH:mm" })
  horaFim?: string;

  @IsOptional()
  @IsDateString()
  feriadoData?: string;

  @IsOptional()
  @IsString()
  escopo?: string;
}
