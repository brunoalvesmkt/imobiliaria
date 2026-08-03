import { IsBoolean, IsEmail, IsOptional } from "class-validator";

/** Um e-mail do contato — mesmo padrão de ContactPhoneDto. */
export class ContactEmailDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;
}
