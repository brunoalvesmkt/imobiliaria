import { Module } from "@nestjs/common";
import { AffiliatesController } from "./affiliates.controller";
import { AffiliatesPublicController } from "./affiliates-public.controller";
import { AffiliateSelfController } from "./affiliate-self.controller";
import { AffiliatesService } from "./affiliates.service";

@Module({
  controllers: [AffiliatesController, AffiliatesPublicController, AffiliateSelfController],
  providers: [AffiliatesService],
  exports: [AffiliatesService],
})
export class AffiliatesModule {}
