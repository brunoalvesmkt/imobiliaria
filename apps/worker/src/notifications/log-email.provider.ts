import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailProvider, SendEmailResult } from "./email-provider.interface";

/**
 * Provedor de e-mail para desenvolvimento/teste — não há credenciais reais
 * de SMTP/API de e-mail disponíveis neste ambiente (mesma situação do
 * FakeUnofficialProvider do WhatsApp e do FakeGatewayProvider do Financeiro,
 * ver DEVELOPMENT_PLAN.md Fases 4 e 8). "Envia" registrando o conteúdo
 * completo no log — o `NotificationsProcessor` persiste a prova de envio em
 * `EmailLog`, então o resultado é auditável/consultável mesmo sem SMTP real.
 */
@Injectable()
export class LogEmailProvider implements EmailProvider {
  readonly name = "log";
  private readonly logger = new Logger(LogEmailProvider.name);

  async send(message: EmailMessage): Promise<SendEmailResult> {
    const providerRef = `log_${randomUUID()}`;
    this.logger.log(`[e-mail simulado] para=${message.to} assunto="${message.assunto}" ref=${providerRef}\n${message.corpo}`);
    return { providerRef };
  }
}
