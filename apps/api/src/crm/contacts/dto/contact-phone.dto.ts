import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

/** Um telefone do contato (documento de alterações, item 10.1). */
export class ContactPhoneDto {
  @IsString()
  @MinLength(1)
  numero!: string;

  @IsIn(["whatsapp", "residencial", "comercial"])
  tipo!: "whatsapp" | "residencial" | "comercial";

  @IsOptional()
  @IsBoolean()
  principal?: boolean;
}
