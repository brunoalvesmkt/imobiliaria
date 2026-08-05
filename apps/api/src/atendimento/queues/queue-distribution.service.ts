import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Regra de distribuição por fila — ver PERMISSIONS_MATRIX.md/prompt mestre
 * §9.6. `round_robin` alterna entre os membros da equipe; `least_volume`
 * escolhe quem tem menos conversas abertas na fila; qualquer outro valor
 * (incluindo "priority", ainda não diferenciado) cai em `least_volume` como
 * padrão seguro.
 *
 * Extraído de `InboxService` (Fase 54) para um módulo próprio, sem
 * dependências de propósito: `ChatbotEngineService` (transferência com
 * distribuição automática) também precisa desta lógica, e importar
 * `AtendimentoModule` direto em `ChatbotModule` arriscaria um ciclo (mesmo
 * motivo documentado em `LeadScoreConfigModule`).
 */
@Injectable()
export class QueueDistributionService {
  constructor(private readonly prisma: PrismaService) {}

  async pickNextMember(queueId: string): Promise<string | null> {
    const queue = await this.prisma.queue.findUniqueOrThrow({ where: { id: queueId } });
    if (!queue.teamId) {
      return null;
    }

    const members = await this.prisma.teamMember.findMany({
      where: { teamId: queue.teamId },
      orderBy: { id: "asc" },
    });
    if (members.length === 0) {
      return null;
    }

    if (queue.distribuicao === "round_robin") {
      const lastAssigned = await this.prisma.conversation.findFirst({
        where: { queueId, responsavelId: { not: null } },
        orderBy: { updatedAt: "desc" },
      });
      if (!lastAssigned?.responsavelId) {
        return members[0]?.tenantUserId ?? null;
      }
      const lastIndex = members.findIndex((m) => m.tenantUserId === lastAssigned.responsavelId);
      const nextIndex = lastIndex === -1 ? 0 : (lastIndex + 1) % members.length;
      return members[nextIndex]?.tenantUserId ?? null;
    }

    // "priority": restringe aos membros com a maior `prioridade` cadastrada
    // na equipe e, entre eles, desempata por menor volume (mesmo critério
    // de "least_volume") — diferente de "least_volume" puro, que ignora
    // prioridade e olha só o volume entre todos os membros.
    const candidates =
      queue.distribuicao === "priority"
        ? members.filter((m) => m.prioridade === Math.max(...members.map((mm) => mm.prioridade)))
        : members;

    // least_volume (padrão) e desempate de "priority"
    const counts = await Promise.all(
      candidates.map(async (m) => ({
        tenantUserId: m.tenantUserId,
        count: await this.prisma.conversation.count({
          where: { queueId, responsavelId: m.tenantUserId, status: { not: "closed" } },
        }),
      })),
    );
    counts.sort((a, b) => a.count - b.count);
    return counts[0]?.tenantUserId ?? null;
  }
}
