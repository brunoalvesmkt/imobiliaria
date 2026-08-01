/**
 * Contrato único de envio de e-mail — mesmo padrão do WhatsAppProvider e do
 * PaymentProvider (ver ARCHITECTURE.md §6): o processador de notificações só
 * fala com esta interface, nunca com um provedor concreto de SMTP/API de
 * e-mail. Trocar por um provedor real (SendGrid, SES, Postfix) é implementar
 * esta interface, sem tocar no resto do sistema.
 */
export interface EmailMessage {
  to: string;
  assunto: string;
  corpo: string;
  template: "welcome" | "password_reset" | "email_confirmation_code";
}

export interface SendEmailResult {
  providerRef: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendEmailResult>;
}
