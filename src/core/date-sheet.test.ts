import { describe, expect, it } from "vitest";
import { bubbleAt, bubbleDots, cardAt, morphAt, morphTransform, poseAt, position, release, sheetLayout, topAt } from "./date-sheet";

// The reference phone: 390 × 844 → the Beet's area is 350 wide, the card's bottom edge at 704 (764 − 60).
// The closed card holds a two-line title and when · where (≈ 148 px of text →
// 192 like the reference); the header starts 42 px above the area, the screen 58 px above it.
// The closed flower fills the room between the text and the card: in the reference that is exactly 0.72.
const REF = sheetLayout({ width: 350, height: 684, flowBottom: 200.6, headH: 148 });

describe("sheetLayout", () => {
  it("matches the reference on 390 × 844: card 192 high, mitte at 176, flower at 0.72 above it", () => {
    expect([REF.tops.zu, REF.tops.mitte, REF.tops.voll]).toEqual([512, 176, -58]);
    expect(REF.zu).toEqual({ x: 62, y: 203, s: 0.72, r: 0 });
  });

  it("the closed card is only as high as its text: a short head leaves the flower more room", () => {
    const short = sheetLayout({ width: 350, height: 684, flowBottom: 198, headH: 70 });
    expect(short.tops.zu).toBe(704 - 114);
    expect(short.zu.y + 420 * short.zu.s).toBeCloseTo(short.tops.zu - 7, 0);
  });

  it("mitte poses are the table's transforms on the closed one", () => {
    // translate(180px, -211px) scale(.444) and translate(173px, -198px) scale(.444) rotate(-14deg)
    expect(REF.mitte.sanft).toMatchObject({ x: 62 + 180, y: 203 - 211, r: 0 });
    expect(REF.mitte.schubs).toMatchObject({ x: 62 + 173, y: 203 - 198, r: -14 });
    expect(REF.mitte.sanft.s).toBeCloseTo(0.72 * 0.444);
    expect(REF.via.schubs).toMatchObject({ x: 62 + 120, y: 203 - 150, r: -38 });
  });

  it("voll: the flower is above the screen, the handle sits on the header's step bar", () => {
    expect(REF.voll.y + 420 * REF.voll.s).toBeLessThan(REF.tops.voll);
    // Step bar in the middle of the header row (−42 + 22), 58 × 6.
    expect(REF.handleVoll).toEqual({ top: -20 - 3 + 58, w: 58, h: 6 });
    // The text starts below the header (it ends 2 px above the area).
    expect(REF.padTop.voll).toBe(2 + 58 + 14);
  });

  it("with more room the closed flower grows to fill it, never wider than the area", () => {
    const tall = sheetLayout({ width: 350, height: 760, flowBottom: 200, headH: 80 });
    expect(tall.zu.s).toBeGreaterThan(0.72);
    expect(tall.zu.y).toBeGreaterThanOrEqual(201);
    expect(tall.zu.y + 420 * tall.zu.s).toBeCloseTo(tall.tops.zu - 7, 0);
    const wide = sheetLayout({ width: 300, height: 1200, flowBottom: 200, headH: 80 });
    expect(300 * wide.zu.s).toBeLessThanOrEqual(300 + 0.01);
  });

  it("a short phone shrinks the closed flower instead of covering the text above it", () => {
    const small = sheetLayout({ width: 320, height: 560, flowBottom: 200, headH: 148 });
    expect(small.zu.y).toBeGreaterThanOrEqual(202);
    expect(small.zu.y + 420 * small.zu.s).toBeLessThanOrEqual(small.tops.zu - 7 + 0.5);
    expect(small.zu.s).toBeLessThan(0.72);
  });

  it("the bubbles stay inside: closed right of the head, at mitte between name and avatars", () => {
    expect(REF.bubbleZu).toMatchObject({ x: 246, y: 208, w: 110 });
    expect(REF.bubbleMitte.sanft).toMatchObject({ x: 92, y: -52, w: 150 });
  });
});

describe("following the card", () => {
  it("position runs 0 → 1 → 2 over the three tops, topAt is its inverse", () => {
    expect([position(512, REF), position(176, REF), position(-58, REF)]).toEqual([0, 1, 2]);
    expect(position(344, REF)).toBeCloseTo(0.5);
    expect(position(59, REF)).toBeCloseTo(1.5);
    for (const p of [0, 0.3, 1, 1.7, 2]) expect(position(topAt(p, REF), REF)).toBeCloseTo(p);
  });

  it("the flower is pushed up, then flies off and comes back down the same way", () => {
    expect(poseAt(0, REF)).toEqual(REF.zu);
    expect(poseAt(1, REF)).toEqual(REF.mitte.sanft);
    expect(poseAt(2, REF)).toEqual(REF.voll);
    const half = poseAt(1.5, REF);
    expect(half.y).toBeLessThan(REF.mitte.sanft.y);
    expect(half.y).toBeGreaterThan(REF.voll.y);
  });

  it("the bubble fades on the way to voll, the card widens and the handle grows into the step bar", () => {
    expect(bubbleAt(1, REF).opacity).toBe(1);
    expect(bubbleAt(1.6, REF).opacity).toBe(0);
    expect(cardAt(1, REF)).toEqual({ inset: 8, radius: 26, bottom: 20, padTop: 24, handle: { top: 8, w: 38, h: 4 } });
    expect(cardAt(2, REF)).toEqual({ inset: 20, radius: 0, bottom: 28, padTop: REF.padTop.voll, handle: REF.handleVoll });
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

describe("release", () => {
  it("goes to the next stop past 35 %, else back", () => {
    expect(release(0.3, "zu", 0.2)).toEqual({ to: "zu", tempo: "sanft" });
    expect(release(0.4, "zu", 0.2)).toEqual({ to: "mitte", tempo: "sanft" });
    expect(release(1.4, "mitte", 0.2)).toEqual({ to: "voll", tempo: "sanft" });
    expect(release(1.2, "mitte", 0.2)).toEqual({ to: "mitte", tempo: "sanft" });
    expect(release(1.5, "voll", -0.3)).toEqual({ to: "mitte", tempo: "sanft" });
    expect(release(0.6, "mitte", -0.3)).toEqual({ to: "zu", tempo: "sanft" });
  });

  it("pulled past mitte in one go it carries on to voll", () => {
    expect(release(1.5, "zu", 0.3)).toEqual({ to: "voll", tempo: "sanft" });
    expect(release(0.3, "voll", -0.3)).toEqual({ to: "zu", tempo: "sanft" });
  });

  it("a flick is a schubs and goes one stop on even when short", () => {
    expect(release(0.15, "zu", 1.2)).toEqual({ to: "mitte", tempo: "schubs" });
    expect(release(1.1, "mitte", 1.2)).toEqual({ to: "voll", tempo: "schubs" });
    expect(release(1.9, "voll", -1.2)).toEqual({ to: "mitte", tempo: "schubs" });
  });
});

describe("the bubble grows out of the step bar", () => {
  it("zu: the bar; mitte: the bubble; voll: back in the bar and gone", () => {
    expect(morphAt(0)).toEqual({ grow: 0, opacity: 0 });
    expect(morphAt(0.5)).toEqual({ grow: 0.5, opacity: 1 });
    expect(morphAt(1)).toEqual({ grow: 1, opacity: 1 });
    expect(morphAt(1.5).grow).toBeCloseTo(0.5);
    expect(morphAt(2)).toEqual({ grow: 0, opacity: 0 });
  });

  it("at 0 it sits on the bar with the bar's size, at 1 on its own box", () => {
    const box = REF.bubbleMitte.sanft;
    // The bar's middle by default: the middle of the area, the header row's middle.
    expect(REF.bar).toEqual({ x: 175, y: -20, w: 58, h: 6 });
    // x, y, z, rotate, sx, sy
    const nums = (t: string) => (t.replace("translate3d", "").match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const [x0, y0, , , sx0, sy0] = nums(morphTransform(box, 60, REF.bar, 0));
    // Its middle (x + w/2, y + h/2) is the bar's middle, scaled to 58 × 6.
    expect(x0 + box.w / 2).toBeCloseTo(175);
    expect(y0 + 30).toBeCloseTo(-20);
    expect(sx0 * box.w).toBeCloseTo(58, 1);
    expect(sy0 * 60).toBeCloseTo(6, 1);
    const [x1, y1, , r1, sx1, sy1] = nums(morphTransform(box, 60, REF.bar, 1));
    expect([x1, y1, r1, sx1, sy1]).toEqual([box.x, box.y, box.rotate, 1, 1]);
  });
});
