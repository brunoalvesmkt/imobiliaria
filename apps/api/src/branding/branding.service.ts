import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SINGLETON_ID = "singleton";

export interface BrandingConfig {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  sizePercent: number;
}

/**
 * Leitura pública (a qualquer usuário autenticado, tenant ou master) da
 * personalização de logotipo definida pelo Master em `PlatformSettings` —
 * separado de `PlatformSettingsService`/`master/settings` porque aquele
 * módulo é acessível apenas a atores master, e o logo precisa aparecer no
 * menu do painel das empresas também.
 */
@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettings() {
    return this.prisma.platformSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  async getTenantBranding(): Promise<BrandingConfig> {
    const settings = await this.getSettings();
    return {
      logoLightUrl: settings.tenantLogoLightUrl,
      logoDarkUrl: settings.tenantLogoDarkUrl,
      sizePercent: settings.tenantLogoSizePercent,
    };
  }

  async getMasterBranding(): Promise<BrandingConfig> {
    const settings = await this.getSettings();
    return {
      logoLightUrl: settings.masterLogoLightUrl,
      logoDarkUrl: settings.masterLogoDarkUrl,
      sizePercent: settings.masterLogoSizePercent,
    };
  }

  /**
   * Sem guard (ver BrandingController) — título, favicon e os logotipos das telas de login
   * precisam aparecer antes de qualquer autenticação (a própria tela de login é a página).
   */
  async getSiteBranding(): Promise<{
    browserTitle: string | null;
    faviconUrl: string | null;
    tenantLoginLogo: BrandingConfig;
    masterLoginLogo: BrandingConfig;
  }> {
    const settings = await this.getSettings();
    return {
      browserTitle: settings.browserTitle,
      faviconUrl: settings.faviconUrl,
      tenantLoginLogo: {
        logoLightUrl: settings.tenantLoginLogoLightUrl,
        logoDarkUrl: settings.tenantLoginLogoDarkUrl,
        sizePercent: settings.tenantLoginLogoSizePercent,
      },
      masterLoginLogo: {
        logoLightUrl: settings.masterLoginLogoLightUrl,
        logoDarkUrl: settings.masterLoginLogoDarkUrl,
        sizePercent: settings.masterLoginLogoSizePercent,
      },
    };
  }
}
