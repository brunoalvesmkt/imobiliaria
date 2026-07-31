import { Controller, Get, NotFoundException, Req } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Resolução de tenant por subdomínio (débito técnico consciente registrado
 * na Fase 10 — "sem frontend multi-tenant real ainda, não há consumidor
 * prático"). Endpoint público (sem `TenantAuthGuard` — é chamado ANTES do
 * login, para uma tela de login com a marca da empresa) que resolve o
 * tenant pelo `Host` da requisição, batendo com `subdominio` (ex.:
 * `empresa.plataforma.com`) ou `dominioCustom` (domínio próprio do
 * tenant). Nunca devolve dados sensíveis — só o necessário para montar a
 * tela de login (nome, logo).
 */
@Controller("public/tenant")
export class PublicTenantController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("branding")
  async branding(@Req() req: Request) {
    const host = (req.hostname || "").toLowerCase();
    const subdominio = host.split(".")[0] ?? "";

    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ subdominio }, { dominioCustom: host }] },
      select: { razaoSocial: true, logoUrl: true, subdominio: true },
    });
    if (!tenant) {
      throw new NotFoundException("Nenhuma empresa encontrada para este domínio.");
    }
    return tenant;
  }
}
