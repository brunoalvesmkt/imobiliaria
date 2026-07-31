import { Controller, Get, UseGuards } from "@nestjs/common";
import { AffiliateAuthGuard } from "../auth/guards/affiliate-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedRequestUser } from "../auth/jwt-payload.interface";
import { AffiliatesService } from "./affiliates.service";

/**
 * Painel de autoatendimento do afiliado (Fase 32, ver DEVELOPMENT_PLAN.md) —
 * só leitura das próprias comissões e indicações, nunca de outro afiliado
 * (o id vem sempre do token JWT, nunca de um parâmetro de rota).
 */
@Controller("affiliate/me")
@UseGuards(AffiliateAuthGuard)
export class AffiliateSelfController {
  constructor(private readonly service: AffiliatesService) {}

  @Get("commissions")
  listCommissions(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.listCommissions(user.id);
  }

  @Get("referrals")
  listReferrals(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.service.listReferrals(user.id);
  }
}
