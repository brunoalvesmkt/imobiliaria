import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Rotas públicas (sem autenticação, protegidas só pelo ThrottlerGuard
 * global) consumidas pela tela "Escolha seu plano" e pelo formulário de
 * cadastro, antes de existir qualquer sessão — documento de alterações da
 * plataforma, seções 2 e 3.
 */
@Controller("public/catalog")
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

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
}
