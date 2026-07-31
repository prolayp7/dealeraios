import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  beforeEach(() => {
    process.env.ACCOUNTS_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ACCOUNTS_ENCRYPTION_KEY;
  });

  test("round-trips a plaintext value", () => {
    const encrypted = encryptSecret("super-secret-cookie-blob", "test-context");
    expect(encrypted).not.toContain("super-secret-cookie-blob");
    expect(decryptSecret(encrypted, "test-context")).toBe(
      "super-secret-cookie-blob"
    );
  });

  test("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input", "test-context");
    const b = encryptSecret("same-input", "test-context");
    expect(a).not.toBe(b);
  });

  test("stores iv:authTag:ciphertext as three base64 segments", () => {
    const encrypted = encryptSecret("x", "test-context");
    expect(encrypted.split(":")).toHaveLength(3);
  });

  test("rejects a tampered ciphertext", () => {
    const encrypted = encryptSecret("original-value", "test-context");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedByte = Buffer.from(ciphertext, "base64");
    tamperedByte[0] = tamperedByte[0] ^ 0xff;
    const tampered = `${iv}:${authTag}:${tamperedByte.toString("base64")}`;
    expect(() => decryptSecret(tampered, "test-context")).toThrow();
  });

  test("rejects a tampered auth tag", () => {
    const encrypted = encryptSecret("original-value", "test-context");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tamperedTag = Buffer.from(authTag, "base64");
    tamperedTag[0] = tamperedTag[0] ^ 0xff;
    const tampered = `${iv}:${tamperedTag.toString("base64")}:${ciphertext}`;
    expect(() => decryptSecret(tampered, "test-context")).toThrow();
  });

  test("rejects a malformed stored value", () => {
    expect(() => decryptSecret("not-the-right-shape", "test-context")).toThrow(
      /malformed/i
    );
  });

  test("throws when ACCOUNTS_ENCRYPTION_KEY is missing", () => {
    delete process.env.ACCOUNTS_ENCRYPTION_KEY;
    expect(() => encryptSecret("x", "test-context")).toThrow(
      /ACCOUNTS_ENCRYPTION_KEY/
    );
  });

  test("throws when ACCOUNTS_ENCRYPTION_KEY decodes to the wrong length", () => {
    process.env.ACCOUNTS_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");
    expect(() => encryptSecret("x", "test-context")).toThrow(/32 bytes/);
  });

  test("rejects decryption with a mismatched context", () => {
    const encrypted = encryptSecret("secret-value", "account-1");
    expect(() => decryptSecret(encrypted, "account-2")).toThrow();
  });
});
