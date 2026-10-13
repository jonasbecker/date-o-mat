import { describe, expect, it } from "vitest";
import { formatInviteCode, generateInviteCode, INVITE_ALPHABET, INVITE_LENGTH, normalizeInviteCode } from "./invite-code";

describe("generateInviteCode", () => {
  it("produces codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_LENGTH);
      for (const char of code) expect(INVITE_ALPHABET).toContain(char);
    }
  });

  it("never contains look-alike characters", () => {
    expect(INVITE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("uses the injected random source", () => {
    expect(generateInviteCode(() => 0)).toBe("AAAAAA");
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["K7P4QX", "K7P4QX"],
    ["k7p-4qx", "K7P4QX"],
    [" K7P 4QX ", "K7P4QX"],
  ])("accepts %j", (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it.each(["", "K7P4Q", "K7P4QXY", "K7P4Q0", "OOOOOO", "K7P_4QX"])("rejects %j", (input) => {
    expect(normalizeInviteCode(input)).toBeNull();
  });
});

describe("formatInviteCode", () => {
  it("adds a dash in the middle", () => {
    expect(formatInviteCode("K7P4QX")).toBe("K7P-4QX");
  });
});
