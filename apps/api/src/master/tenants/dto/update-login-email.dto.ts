import { IsEmail } from "class-validator";

export class UpdateLoginEmailDto {
  @IsEmail()
  email!: string;
}
