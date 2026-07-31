import { generateOpaqueToken, hashOpaqueToken, hashPassword, slugify, verifyPassword } from "./crypto.util";

describe("crypto.util", () => {
  describe("hashPassword / verifyPassword", () => {
    it("verifies a correct password against its hash", async () => {
      const hash = await hashPassword("SenhaForte123");
      await expect(verifyPassword(hash, "SenhaForte123")).resolves.toBe(true);
    });

    it("rejects an incorrect password", async () => {
      const hash = await hashPassword("SenhaForte123");
      await expect(verifyPassword(hash, "SenhaErrada123")).resolves.toBe(false);
    });

    it("never stores the plain password in the hash output", async () => {
      const hash = await hashPassword("SenhaForte123");
      expect(hash).not.toContain("SenhaForte123");
      expect(hash.startsWith("$argon2id$")).toBe(true);
    });
  });

  describe("generateOpaqueToken / hashOpaqueToken", () => {
    it("generates high-entropy, unique tokens", () => {
      const a = generateOpaqueToken();
      const b = generateOpaqueToken();
      expect(a).not.toEqual(b);
      expect(a).toHaveLength(64); // 32 bytes hex-encoded
    });

    it("hashes deterministically (needed for refresh-token lookup by hash)", () => {
      const token = generateOpaqueToken();
      expect(hashOpaqueToken(token)).toEqual(hashOpaqueToken(token));
    });

    it("produces different hashes for different tokens", () => {
      const a = generateOpaqueToken();
      const b = generateOpaqueToken();
      expect(hashOpaqueToken(a)).not.toEqual(hashOpaqueToken(b));
    });
  });

  describe("slugify", () => {
    it("removes accents and lowercases", () => {
      expect(slugify("Empresa São Paulo Ltda")).toBe("empresa-sao-paulo-ltda");
    });

    it("collapses non-alphanumeric runs into a single hyphen", () => {
      expect(slugify("A & B --- C!!!")).toBe("a-b-c");
    });

    it("trims leading/trailing hyphens", () => {
      expect(slugify("--Empresa--")).toBe("empresa");
    });
  });
});
