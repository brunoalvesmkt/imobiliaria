/**
 * Remove o DDI do Brasil ("55") de um número de WhatsApp, quando presente —
 * usado ao criar automaticamente o telefone de um Contact a partir de uma
 * conversa (chatbot, automação), para bater com o formato "sem DDI" digitado
 * manualmente no cadastro de contato.
 */
export function stripDddiBrasil(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}
