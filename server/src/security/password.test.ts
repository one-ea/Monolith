import { describe, expect, it } from "vitest";
import {
  fingerprintPasswordHash,
  hashPassword,
  normalizePassword,
  verifyPassword,
} from "./password";

const FAST_ITERATIONS = 10_000;

describe("password hashing", () => {
  it("round-trips a password", async () => {
    const hash = await hashPassword("correct horse battery staple", FAST_ITERATIONS);
    expect(hash.startsWith("pbkdf2-sha256$1$10000$")).toBe(true);
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("secret", FAST_ITERATIONS);
    await expect(verifyPassword("Secret", hash)).resolves.toBe(false);
    await expect(verifyPassword("secret ", hash)).resolves.toBe(false);
  });

  it("rejects malformed or tampered hashes", async () => {
    const hash = await hashPassword("secret", FAST_ITERATIONS);
    await expect(verifyPassword("secret", `${hash}x`)).resolves.toBe(false);
    await expect(verifyPassword("secret", "pbkdf2-sha256$1$10000$bad")).resolves.toBe(false);
    await expect(verifyPassword("secret", "")).resolves.toBe(false);
    await expect(verifyPassword("secret", "bcrypt$1$10000$abc$def")).resolves.toBe(false);
  });

  it("keeps Unicode and spaces intact", async () => {
    const password = " 密码 with spaces  ";
    const hash = await hashPassword(password, FAST_ITERATIONS);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("密码 with spaces", hash)).resolves.toBe(false);
  });

  it("changes the fingerprint when the hash changes", async () => {
    const first = await hashPassword("secret", FAST_ITERATIONS);
    const second = await hashPassword("secret", FAST_ITERATIONS);
    expect(await fingerprintPasswordHash(first)).not.toBe(await fingerprintPasswordHash(second));
  });

  it("validates password length without trimming", () => {
    expect(normalizePassword(" a ")).toBe(" a ");
    expect(normalizePassword("")).toBeNull();
    expect(normalizePassword("x".repeat(257))).toBeNull();
    expect(normalizePassword(123)).toBeNull();
  });
});
