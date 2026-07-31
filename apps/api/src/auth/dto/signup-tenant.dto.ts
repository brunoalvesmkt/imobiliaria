import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength, Validate } from "class-validator";
import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ name: "MatchesField", async: false })
class MatchesFieldConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const [relatedField] = args.constraints as [string];
    const relatedValue = (args.object as Record<string, unknown>)[relatedField];
    return value === relatedValue;
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedField] = args.constraints as [string];
    return `${args.property} deve ser igual a ${relatedField}`;
  }
}

function MatchesField(relatedField: string) {
  return Validate(MatchesFieldConstraint, [relatedField]);
}

export class SignupTenantDto {
  @IsString()
  @IsNotEmpty()
  razaoSocial!: string;

  @Matches(/^\d{14}$/, { message: "cnpj deve conter 14 dígitos numéricos" })
  cnpj!: string;

  @IsString()
  @IsNotEmpty()
  responsavel!: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsEmail()
  email!: string;

  @IsEmail()
  @MatchesField("email")
  confirmacaoEmail!: string;

  @MinLength(10, { message: "senha deve ter ao menos 10 caracteres" })
  senha!: string;

  @MatchesField("senha")
  confirmacaoSenha!: string;

  @IsOptional()
  @IsString()
  affiliateLinkCode?: string;
}
