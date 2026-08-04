import { IsOptional, IsUUID } from "class-validator";

/** `responsavelId` ausente/null desatribui a oportunidade ("Sem responsável"). */
export class TransferResponsavelDto {
  @IsOptional()
  @IsUUID()
  responsavelId?: string | null;
}
