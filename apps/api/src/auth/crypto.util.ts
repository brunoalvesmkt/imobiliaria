import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";

/** Hash de senha — Argon2id (ver SECURITY.md §1). */
export function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(hash, plainPassword);
}

/**
 * Tokens opacos (refresh token, reset de senha) são strings aleatórias de
 * alta entropia — não senhas escolhidas por humano — então usamos SHA-256
 * (rápido, determinístico, permite lookup por igualdade) para armazenar o
 * hash em vez do valor puro. Argon2 nesse caso seria custo sem benefício de
 * segurança adicional, já que o token não é adivinhável por força bruta de
 * dicionário como uma senha.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashOpaqueToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
