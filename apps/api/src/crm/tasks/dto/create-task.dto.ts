import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

const TIPOS = ["retorno", "ligacao", "reuniao", "proposta", "cobranca", "pos_venda", "avaliacao", "custom"];

export class CreateTaskDto {
  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsIn(TIPOS)
  tipo!: string;

  @IsString()
  @MinLength(1)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  dataHora!: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;
}
