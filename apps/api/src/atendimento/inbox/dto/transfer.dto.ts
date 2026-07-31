import { IsOptional, IsUUID } from "class-validator";

/** Informe exatamente um dos dois: transferir para um atendente específico ou para outra fila. */
export class TransferDto {
  @IsOptional()
  @IsUUID()
  tenantUserId?: string;

  @IsOptional()
  @IsUUID()
  queueId?: string;
}
