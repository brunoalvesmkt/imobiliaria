import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { FakeGatewayProvider } from "./fake-gateway.provider";
import { StripeProvider } from "./stripe.provider";
import type { PaymentProvider } from "./payment-provider.interface";

export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";

/**
 * Seleção de provedor por env var (`PAYMENT_GATEWAY_PROVIDER`, default
 * "fake") — mesmo espírito do `AiProviderRegistryService`/`resolve(name)`
 * da Fase 11, mas mais simples aqui porque o Financeiro só fala com UM
 * gateway configurado por vez (não escolhido por tenant como a IA), então
 * um factory provider resolve na inicialização em vez de precisar de um
 * registry consultado em runtime.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    FakeGatewayProvider,
    StripeProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, FakeGatewayProvider, StripeProvider],
      useFactory: (config: ConfigService, fake: FakeGatewayProvider, stripe: StripeProvider): PaymentProvider => {
        const selected = config.get<string>("PAYMENT_GATEWAY_PROVIDER") ?? "fake";
        return selected === "stripe" ? stripe : fake;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentProvidersModule {}
