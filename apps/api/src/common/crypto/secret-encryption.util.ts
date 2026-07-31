import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia simétrica reversível para segredos que precisam ser
 * recuperados em texto puro (ex.: a API key de IA que o tenant cadastra —
 * precisa ser enviada de volta ao provedor). Diferente de `crypto.util.ts`
 * (hash de senha/token, irreversível por design), aqui o objetivo é
 * confidencialidade em repouso, não verificação por igualdade.
 *
 * AES-256-GCM: `ENCRYPTION_KEY` é uma chave de 32 bytes em base64 (gerar com
 * `openssl rand -base64 32`). O payload guardado é `iv + authTag + ciphertext`
 * concatenados e codificados em base64 — autoconsistente, sem precisar de
 * coluna extra para o IV.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recomendado para GCM
const AUTH_TAG_LENGTH = 16;

function resolveKey(encryptionKeyBase64: string): Buffer {
  const key = Buffer.from(encryptionKeyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY inválida — precisa decodificar para exatamente 32 bytes (256 bits) em base64.");
  }
  return key;
}

export function encryptSecret(plain: string, encryptionKeyBase64: string): string {
  const key = resolveKey(encryptionKeyBase64);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(payloadBase64: string, encryptionKeyBase64: string): string {
  const key = resolveKey(encryptionKeyBase64);
  const payload = Buffer.from(payloadBase64, "base64");

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
