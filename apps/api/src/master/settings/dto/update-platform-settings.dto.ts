import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

/**
 * PNG em base64: ~1.37x o tamanho binário, então 200KB (204800 bytes)
 * vira até ~280600 caracteres de base64. Damos uma folga e limitamos a
 * string completa (incluindo o prefixo "data:image/png;base64,") a 290000.
 */
const MAX_LOGO_DATA_URI_LENGTH = 290_000;

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsBoolean()
  planSelectionEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMonthly?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAnnual?: boolean;

  @IsOptional()
  @IsBoolean()
  showPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  showTrialPeriod?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  subscribeButtonText?: string;

  @IsOptional()
  @IsBoolean()
  allowPlanChangeBeforeSignup?: boolean;

  @IsOptional()
  @IsBoolean()
  emailConfirmRepeatEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailConfirmCodeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tenantCanEditProfile?: boolean;

  @IsOptional()
  @IsBoolean()
  requireCodeOnEmailChange?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  riskTermVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  riskTermText?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleOrder?: string[];

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  tenantLogoLightUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  tenantLogoDarkUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(200)
  tenantLogoSizePercent?: number;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  masterLogoLightUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  masterLogoDarkUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(200)
  masterLogoSizePercent?: number;
}
