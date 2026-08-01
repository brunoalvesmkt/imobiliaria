import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

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
}
