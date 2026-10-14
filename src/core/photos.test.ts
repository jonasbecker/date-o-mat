import { describe, expect, it } from "vitest";
import { fitWithin, sniffImageType } from "./photos";

describe("fitWithin", () => {
  it("scales the longer edge down", () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 480)).toEqual({ width: 360, height: 480 });
  });
  it("never scales up", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe("sniffImageType", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  it("recognizes JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
  });
  it("rejects everything else, e.g. HTML posing as an image", () => {
    expect(sniffImageType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
  });
});
