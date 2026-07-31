import { createHmac } from "node:crypto";
import { verifyStripeSignature } from "./stripe-signature.util";

function sign(payload: string, secret: string, timestamp: number): string {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_segredo";
  const payload = JSON.stringify({ id: "evt_123", type: "checkout.session.completed" });

  it("aceita uma assinatura válida e recente", () => {
    const header = sign(payload, secret, Math.floor(Date.now() / 1000));
    expect(verifyStripeSignature(payload, header, secret)).toBe(true);
  });

  it("rejeita quando o corpo foi adulterado", () => {
    const header = sign(payload, secret, Math.floor(Date.now() / 1000));
    expect(verifyStripeSignature(payload + "adulterado", header, secret)).toBe(false);
  });

  it("rejeita com o segredo errado", () => {
    const header = sign(payload, "whsec_outro_segredo", Math.floor(Date.now() / 1000));
    expect(verifyStripeSignature(payload, header, secret)).toBe(false);
  });

  it("rejeita timestamp fora da janela de tolerância (replay)", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1h atrás
    const header = sign(payload, secret, oldTimestamp);
    expect(verifyStripeSignature(payload, header, secret)).toBe(false);
  });

  it("rejeita header ausente ou malformado", () => {
    expect(verifyStripeSignature(payload, undefined, secret)).toBe(false);
    expect(verifyStripeSignature(payload, "header-invalido", secret)).toBe(false);
    expect(verifyStripeSignature(payload, "t=abc,v1=xyz", secret)).toBe(false);
  });

  it("rejeita quando não há segredo configurado", () => {
    const header = sign(payload, secret, Math.floor(Date.now() / 1000));
    expect(verifyStripeSignature(payload, header, undefined)).toBe(false);
  });
});
