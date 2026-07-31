import { IsIn, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class CreateNumberDto {
  @IsIn(["chatbot", "atendente"])
  tipo!: "chatbot" | "atendente";

  @IsIn(["official_api", "unofficial"])
  modalidade!: "official_api" | "unofficial";

  @Matches(/^\d{10,15}$/, { message: "numero deve conter apenas dígitos (formato E.164 sem +)" })
  numero!: string;

  @IsOptional()
  @IsString()
  externalAccountId?: string;

  @IsOptional()
  @IsUUID()
  responsavelId?: string;
}
