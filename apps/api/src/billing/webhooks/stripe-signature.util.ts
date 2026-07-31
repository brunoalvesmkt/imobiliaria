import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Verificação da assinatura de webhook do Stripe — formato documentado
 * `t=<timestamp>,v1=<hmac>` no header `stripe-signature`. Mesmo padrão de
 * verificação HMAC + `timingSafeEqual` já usado para o webhook da Meta
 * (`MetaOfficialProvider.verifyWebhookSignature`), adaptado ao esquema
 * próprio do Stripe (que inclui o timestamp na mensagem assinada e exige
 * checar a janela de tolerância para prevenir replay).
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string | undefined,
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): boolean {
  if (!secret || !signatureHeader) {
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const receivedSignature = parts.v1;
  if (!timestamp || !receivedSignature) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > toleranceSeconds) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(receivedSignature);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
