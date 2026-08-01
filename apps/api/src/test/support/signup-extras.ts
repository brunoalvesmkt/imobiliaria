import type { INestApplication } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Depois do documento de alterações da plataforma (seção 3), `POST
 * /auth/tenant/signup` passou a exigir endereço completo, segmento e um
 * plano público real. Este helper cria (de forma idempotente, direto via
 * Prisma — nunca aparece na tela pública de verdade porque testes rodam
 * contra o banco de teste, não produção) um plano e um segmento utilizáveis
 * pelos ~30 arquivos de spec que criam uma empresa de teste via signup, sem
 * duplicar essa lógica em cada arquivo.
 */
export async function ensureTestPlan(prisma: PrismaService) {
  const existing = await prisma.plan.findFirst({ where: { nome: "__test_plan__" } });
  if (existing) return existing;
  return prisma.plan.create({
    data: {
      nome: "__test_plan__",
      preco: 0,
      modulos: [],
      limites: {},
      ativo: true,
      publicoAtivo: true,
      diasTeste: 14,
    },
  });
}

export async function ensureTestSegment(prisma: PrismaService) {
  const existing = await prisma.segment.findFirst({ where: { ativo: true } });
  if (existing) return existing;
  return prisma.segment.create({ data: { nome: "__test_segment__", ativo: true } });
}

/**
 * Recebe `app` (a instância Nest — sempre disponível em todo arquivo de
 * spec e2e) em vez de `PrismaService` diretamente, para não obrigar cada um
 * dos ~30 arquivos de teste a injetar/expor uma variável `prisma` só para
 * chamar este helper.
 */
export async function signupExtras(app: INestApplication) {
  const prisma = app.get(PrismaService);
  const [plan, segmento] = await Promise.all([ensureTestPlan(prisma), ensureTestSegment(prisma)]);
  return {
    telefone: "11987654321",
    whatsapp: "11987654321",
    segmentoId: segmento.id,
    endereco: "Rua de Teste",
    numero: "100",
    bairro: "Centro",
    cidade: "São Paulo",
    uf: "SP",
    cep: "01000-000",
    planId: plan.id,
    periodicidade: "mensal" as const,
  };
}
