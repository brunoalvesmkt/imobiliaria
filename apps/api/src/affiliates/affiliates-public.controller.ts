import { Controller, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { AffiliatesService } from "./affiliates.service";

/** Rota pública (sem autenticação) para rastreio de clique no link de afiliado — protegida pelo ThrottlerGuard global. */
@Controller("public/affiliates")
export class AffiliatesPublicController {
  constructor(private readonly service: AffiliatesService) {}

  @Post(":linkCode/click")
  @HttpCode(HttpStatus.OK)
  trackClick(@Param("linkCode") linkCode: string) {
    return this.service.trackClick(linkCode);
  }
}
