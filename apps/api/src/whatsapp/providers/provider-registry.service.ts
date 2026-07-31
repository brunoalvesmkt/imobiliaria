import { Injectable, NotFoundException } from "@nestjs/common";
import { MetaOfficialProvider } from "./meta-official.provider";
import { FakeUnofficialProvider } from "./fake-unofficial.provider";
import { BaileysUnofficialProvider } from "./baileys/baileys-unofficial.provider";
import type { WhatsAppProvider } from "./whatsapp-provider.interface";

@Injectable()
export class ProviderRegistryService {
  constructor(
    private readonly metaOfficial: MetaOfficialProvider,
    private readonly fakeUnofficial: FakeUnofficialProvider,
    private readonly baileysUnofficial: BaileysUnofficialProvider,
  ) {}

  resolve(providerName: string): WhatsAppProvider {
    switch (providerName) {
      case "meta":
        return this.metaOfficial;
      case "fake_unofficial":
        return this.fakeUnofficial;
      case "baileys_unofficial":
        return this.baileysUnofficial;
      default:
        throw new NotFoundException(`Provedor desconhecido: "${providerName}".`);
    }
  }
}
