import { Module } from "@nestjs/common";
import { PublicCatalogController } from "./public-catalog.controller";

@Module({
  controllers: [PublicCatalogController],
})
export class PublicCatalogModule {}
