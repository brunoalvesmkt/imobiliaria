import { Injectable } from "@nestjs/common";
import { Prisma } from "@chatbot-saas/database";
import { PrismaService } from "../prisma/prisma.service";
import { AutomationProducer } from "./automation.producer";

export interface ScheduleFollowUpInput {
  tenantId: string;
  automationId: string;
  contactId?: string | null;
  conversationId?: string | null;
  delayMinutes: number;
  texto: string;
  sequenciaIndex?: number;
  /** Snapshot do payload.data do evento que originou a execução — usado para revalidar as condições da automação quando o follow-up dispara (ver AutomationProcessor.sendFollowUp). */
  dadosGatilho?: Prisma.InputJsonValue | null;
}

/**
 * Follow-ups agendados (seção 12.5 do prompt mestre). Cancelamento
 * automático é chamado pelos módulos que sabem quando ele deve parar de
 * fazer sentido — resposta do cliente (WhatsApp), atendimento encerrado
 * (Atendimento), venda concluída/oportunidade perdida (CRM) — ver
 * ACCEPTANCE_CRITERIA.md, caso crítico #9.
 */
@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: AutomationProducer,
  ) {}

  async schedule(input: ScheduleFollowUpInput) {
    const delayMs = Math.max(input.delayMinutes, 0) * 60_000;
    const followUp = await this.prisma.followUpSchedule.create({
      data: {
        tenantId: input.tenantId,
        automationId: input.automationId,
        contactId: input.contactId ?? null,
        conversationId: input.conversationId ?? null,
        mensagem: input.texto,
        sequenciaIndex: input.sequenciaIndex ?? 0,
        agendadoPara: new Date(Date.now() + delayMs),
        status: "scheduled",
        ...(input.dadosGatilho !== undefined ? { dadosGatilho: input.dadosGatilho ?? Prisma.JsonNull } : {}),
      },
    });

    await this.producer.enqueueFollowUp(followUp.id, delayMs);
    return followUp;
  }

  private async cancelMany(where: { conversationId?: string; contactId?: string }, motivo: string): Promise<void> {
    const pending = await this.prisma.followUpSchedule.findMany({ where: { ...where, status: "scheduled" } });
    for (const followUp of pending) {
      await this.prisma.followUpSchedule.update({
        where: { id: followUp.id },
        data: { status: "cancelled", canceladoPorEvento: motivo },
      });
      await this.producer.cancelFollowUp(followUp.id);
    }
  }

  cancelByConversation(conversationId: string, motivo: string): Promise<void> {
    return this.cancelMany({ conversationId }, motivo);
  }

  cancelByContact(contactId: string, motivo: string): Promise<void> {
    return this.cancelMany({ contactId }, motivo);
  }
}
