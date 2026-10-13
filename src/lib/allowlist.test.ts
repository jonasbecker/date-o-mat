import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowlist } from "./allowlist";

describe("allowlist", () => {
  const list = parseAllowlist(" Jonas@Gmail.com, partnerin@gmail.com ,, ");

  it("normalizes case and whitespace", () => {
    expect([...list]).toEqual(["jonas@gmail.com", "partnerin@gmail.com"]);
  });

  it("allows listed addresses regardless of case", () => {
    expect(isEmailAllowed("JONAS@gmail.com", list)).toBe(true);
    expect(isEmailAllowed("partnerin@gmail.com", list)).toBe(true);
  });

  it("rejects everybody else", () => {
    expect(isEmailAllowed("stranger@gmail.com", list)).toBe(false);
    expect(isEmailAllowed("", list)).toBe(false);
  });
});
