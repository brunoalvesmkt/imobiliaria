import { Module } from "@nestjs/common";
import { MetaOfficialProvider } from "./meta-official.provider";
import { FakeUnofficialProvider } from "./fake-unofficial.provider";
import { ProviderRegistryService } from "./provider-registry.service";
import { BaileysLoaderService } from "./baileys/baileys-esm.loader";
import { BaileysConnectionManagerService } from "./baileys/baileys-connection-manager.service";
import { BaileysUnofficialProvider } from "./baileys/baileys-unofficial.provider";

@Module({
  providers: [
    MetaOfficialProvider,
    FakeUnofficialProvider,
    BaileysLoaderService,
    BaileysConnectionManagerService,
    BaileysUnofficialProvider,
    ProviderRegistryService,
  ],
  exports: [ProviderRegistryService],
})
export class ProvidersModule {}
