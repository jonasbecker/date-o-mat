import { describe, expect, it } from "vitest";
import { bubbleDots, progress, release, sheetLayout } from "./date-sheet";

// The reference phone: 390 × 844 → the Beet's area is 350 wide, the card's bottom edge at 704 (764 − 60).
// The subtitle ends at 258 (198 here).
const REF = sheetLayout({ width: 350, height: 684, flowBottom: 198 });

describe("sheetLayout", () => {
  it("matches the reference on 390 × 844: card 192 high, open at 176, flower at 0.72 above it", () => {
    expect([REF.cardTopZu, REF.cardTopOpen]).toEqual([512, 176]);
    expect(REF.zu).toEqual({ x: 62, y: 203, s: 0.72, r: 0 });
  });

  it("open poses are the table's transforms on the closed one", () => {
    // translate(180px, -211px) scale(.444) and translate(173px, -198px) scale(.444) rotate(-14deg)
    expect(REF.offen.sanft).toMatchObject({ x: 62 + 180, y: 203 - 211, r: 0 });
    expect(REF.offen.schubs).toMatchObject({ x: 62 + 173, y: 203 - 198, r: -14 });
    expect(REF.offen.sanft.s).toBeCloseTo(0.72 * 0.444);
    expect(REF.mitte.schubs).toMatchObject({ x: 62 + 120, y: 203 - 150, r: -38 });
  });

  it("a short phone shrinks the closed flower instead of covering the text above it", () => {
    const small = sheetLayout({ width: 320, height: 560, flowBottom: 200 });
    expect(small.zu.y).toBeGreaterThanOrEqual(202);
    expect(small.zu.y + 420 * small.zu.s).toBeLessThanOrEqual(small.cardTopZu - 7 + 0.5);
    expect(small.zu.s).toBeLessThan(0.72);
  });

  it("the bubbles stay inside: closed right of the head, open between name and avatars", () => {
    expect(REF.bubbleZu).toMatchObject({ x: 246, y: 208, w: 110 });
    expect(REF.bubbleOffen.sanft).toMatchObject({ x: 92, y: -52, w: 150 });
  });
});

describe("bubbleDots", () => {
  it("closed: the small dot just outside the petals, the big one on the way to the bubble (≈ reference)", () => {
    const { small, big } = bubbleDots(REF.zu, { x: 246, y: 208, w: 110, h: 70 });
    // Reference (screen): small 243, 340 · big 254, 326 → minus 20, 60.
    expect(Math.abs(small.x - 223)).toBeLessThan(6);
    expect(Math.abs(small.y - 280)).toBeLessThan(6);
    expect(big.x).toBeGreaterThan(small.x);
    expect(big.x).toBeLessThan(246);
  });
});

describe("progress and release", () => {
  it("progress runs from the closed top to the open one", () => {
    expect(progress(512, REF)).toBe(0);
    expect(progress(176, REF)).toBe(1);
    expect(progress(344, REF)).toBeCloseTo(0.5);
  });

  it("opens past 35 %, a flick is a schubs, and closing works the other way round", () => {
    expect(release(0.3, false, 0.2)).toEqual({ open: false, tempo: "sanft" });
    expect(release(0.4, false, 0.2)).toEqual({ open: true, tempo: "sanft" });
    expect(release(0.4, false, 1.2)).toEqual({ open: true, tempo: "schubs" });
    expect(release(0.7, true, -0.3)).toEqual({ open: true, tempo: "sanft" });
    expect(release(0.6, true, -0.3)).toEqual({ open: false, tempo: "sanft" });
  });
});
