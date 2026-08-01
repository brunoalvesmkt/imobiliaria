import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformSettingsService } from "../master/settings/platform-settings.service";

/**
 * Rotas públicas (sem autenticação, protegidas só pelo ThrottlerGuard
 * global) consumidas pela tela "Escolha seu plano" e pelo formulário de
 * cadastro, antes de existir qualquer sessão — documento de alterações da
 * plataforma, seções 2 e 3.
 */
@Controller("public/catalog")
export class PublicCatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  @Get("plans")
  async plans() {
    const plans = await this.prisma.plan.findMany({
      where: { ativo: true, publicoAtivo: true },
      orderBy: [{ ordem: "asc" }, { preco: "asc" }],
    });
    // Nunca expor `limites`/`modulos` crus além do necessário para a tela
    // pública — mas como hoje são só listas/objetos simples de exibição,
    // devolvemos como estão (nenhum segredo neles).
    return plans;
  }

  @Get("segments")
  async segments() {
    return this.prisma.segment.findMany({
      where: { ativo: true },
      orderBy: { ordem: "asc" },
    });
  }

  /**
   * Subconjunto de `PlatformSettings` seguro para expor sem autenticação —
   * governa a UI pública de "Escolha seu plano" e do formulário de cadastro
   * (documento de alterações, seção 5.1/5.2/5.3). Campos administrativos
   * (ex.: `tenantCanEditProfile`, que só importa dentro do painel já
   * autenticado) ficam de fora de propósito.
   */
  @Get("settings")
  async settings() {
    const s = await this.platformSettings.get();
    return {
      planSelectionEnabled: s.planSelectionEnabled,
      allowMonthly: s.allowMonthly,
      allowAnnual: s.allowAnnual,
      showPrices: s.showPrices,
      showTrialPeriod: s.showTrialPeriod,
      subscribeButtonText: s.subscribeButtonText,
      allowPlanChangeBeforeSignup: s.allowPlanChangeBeforeSignup,
      emailConfirmRepeatEnabled: s.emailConfirmRepeatEnabled,
      emailConfirmCodeEnabled: s.emailConfirmCodeEnabled,
    };
  }
}
