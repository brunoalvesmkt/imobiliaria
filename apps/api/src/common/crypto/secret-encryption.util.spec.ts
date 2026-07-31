import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "./secret-encryption.util";

const TEST_KEY = randomBytes(32).toString("base64");

describe("secret-encryption.util", () => {
  it("round-trips a plain secret through encrypt/decrypt", () => {
    const encrypted = encryptSecret("sk-ant-api03-minha-chave-secreta", TEST_KEY);
    expect(encrypted).not.toContain("minha-chave-secreta");
    expect(decryptSecret(encrypted, TEST_KEY)).toBe("sk-ant-api03-minha-chave-secreta");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("mesma-chave", TEST_KEY);
    const b = encryptSecret("mesma-chave", TEST_KEY);
    expect(a).not.toEqual(b);
  });

  it("fails to decrypt if the payload was tampered with (auth tag mismatch)", () => {
    const encrypted = encryptSecret("valor-original", TEST_KEY);
    const buffer = Buffer.from(encrypted, "base64");
    buffer[buffer.length - 1] = buffer[buffer.length - 1]! ^ 0xff;
    const tampered = buffer.toString("base64");

    expect(() => decryptSecret(tampered, TEST_KEY)).toThrow();
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptSecret("valor-original", TEST_KEY);
    const wrongKey = randomBytes(32).toString("base64");
    expect(() => decryptSecret(encrypted, wrongKey)).toThrow();
  });

  it("rejects an encryption key that isn't exactly 32 bytes", () => {
    expect(() => encryptSecret("valor", Buffer.from("chave-curta").toString("base64"))).toThrow();
  });
});
