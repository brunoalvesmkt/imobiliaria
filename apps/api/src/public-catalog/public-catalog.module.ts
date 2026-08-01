import { Module } from "@nestjs/common";
import { PlatformSettingsModule } from "../master/settings/platform-settings.module";
import { PublicCatalogController } from "./public-catalog.controller";

@Module({
  imports: [PlatformSettingsModule],
  controllers: [PublicCatalogController],
})
export class PublicCatalogModule {}
