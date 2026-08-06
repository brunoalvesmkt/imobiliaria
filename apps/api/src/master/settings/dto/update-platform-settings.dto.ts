import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

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

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  tenantLoginLogoLightUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  tenantLoginLogoDarkUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(200)
  tenantLoginLogoSizePercent?: number;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  masterLoginLogoLightUrl?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  masterLoginLogoDarkUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(200)
  masterLoginLogoSizePercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(70)
  browserTitle?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^data:image\/png;base64,/)
  @MaxLength(MAX_LOGO_DATA_URI_LENGTH)
  faviconUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  announcementEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  announcementText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  announcementLinkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  announcementLinkText?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  announcementBgColor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  announcementTextColor?: string | null;

  @IsOptional()
  @IsIn(["left", "center", "right"])
  announcementAlign?: string;

  @IsOptional()
  @IsBoolean()
  announcementBold?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  announcementButtonColor?: string | null;

  @IsOptional()
  @IsIn(["rounded", "square"])
  announcementButtonShape?: string;

  @IsOptional()
  @IsBoolean()
  announcementButtonBold?: boolean;

  @IsOptional()
  @IsIn(["session", "always"])
  announcementDismissMode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  announcementButtonTextColor?: string | null;

  @IsOptional()
  @IsBoolean()
  masterAnnouncementEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  masterAnnouncementText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  masterAnnouncementLinkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  masterAnnouncementLinkText?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  masterAnnouncementBgColor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  masterAnnouncementTextColor?: string | null;

  @IsOptional()
  @IsIn(["left", "center", "right"])
  masterAnnouncementAlign?: string;

  @IsOptional()
  @IsBoolean()
  masterAnnouncementBold?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  masterAnnouncementButtonColor?: string | null;

  @IsOptional()
  @IsIn(["rounded", "square"])
  masterAnnouncementButtonShape?: string;

  @IsOptional()
  @IsBoolean()
  masterAnnouncementButtonBold?: boolean;

  @IsOptional()
  @IsIn(["session", "always"])
  masterAnnouncementDismissMode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  masterAnnouncementButtonTextColor?: string | null;
}
