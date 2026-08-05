import { IsOptional, IsUUID } from "class-validator";

/** Informe exatamente um: transferir para um atendente específico, uma fila ou uma equipe. */
export class TransferDto {
  @IsOptional()
  @IsUUID()
  tenantUserId?: string;

  @IsOptional()
  @IsUUID()
  queueId?: string;

  /** Resolvido para a fila de maior prioridade da equipe (ver InboxService.transfer) — Conversation não tem campo de equipe próprio. */
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
