import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, parseKey, randomToken, sha256Hex } from "./crypto";

const key = randomBytes(32);

describe("encrypt/decrypt", () => {
  it("round-trips text", () => {
    const secret = "1//0refresh-token-äöü";
    expect(decrypt(encrypt(secret, key), key)).toBe(secret);
  });

  it("uses a fresh IV every time", () => {
    expect(encrypt("same", key)).not.toBe(encrypt("same", key));
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, data] = encrypt("hello", key).split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 0xff;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64url")].join("."), key)).toThrow();
  });

  it("rejects the wrong key", () => {
    expect(() => decrypt(encrypt("hello", key), randomBytes(32))).toThrow();
  });

  it("rejects malformed payloads", () => {
    expect(() => decrypt("not-encrypted", key)).toThrow("Malformed");
  });
});

describe("parseKey", () => {
  it("accepts a 32-byte base64 key", () => {
    expect(parseKey(key.toString("base64"))).toHaveLength(32);
  });

  it("rejects keys of the wrong length", () => {
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow("32 bytes");
  });
});

describe("tokens", () => {
  it("creates url-safe random tokens", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken(32)).not.toBe(token);
  });

  it("hashes deterministically", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
