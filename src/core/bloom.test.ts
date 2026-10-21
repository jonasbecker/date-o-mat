import { describe, expect, it } from "vitest";
import { bloomGeometry, bloomLeaves, bloomSaying, bloomStimmung, shownPot, unlockedPots } from "./bloom";

describe("bloomGeometry (renderVals of Bloom.html)", () => {
  it("genervt: 8 petals Ø40 at 42, face 64, flat eyes and mouth, head +8°", () => {
    const g = bloomGeometry("genervt", 3);
    expect(g.petals).toHaveLength(8);
    expect(g.face).toEqual({ d: 64, sad: false, visible: true });
    expect([g.eyes, g.mouth, g.head.rotate]).toEqual(["flat", "flat", 8]);
  });

  it("autsch: petals 1 and 4 are gone, cross eyes, open mouth, head −18°, stars", () => {
    const g = bloomGeometry("autsch", 3);
    expect(g.petals).toHaveLength(6);
    expect(g.petals[0]).toEqual({ x: -20, y: -63, d: 40, light: false });
    expect([g.eyes, g.mouth, g.head.rotate, g.sparkles.length]).toEqual(["x", "ouch", -18, 4]);
  });

  it("the five round moods are unchanged by the new ones", () => {
    expect(bloomGeometry("froh", 4).petals.map((p) => p.d)).toEqual(Array(8).fill(42));
    expect([bloomGeometry("wartet", 3).eyes, bloomGeometry("wartet", 3).mouth, bloomGeometry("wartet", 3).head.rotate]).toEqual(["dot", "o", 0]);
    expect(bloomGeometry("traurig", 3).eyes).toBe("dot");
  });

  it("waits: 8 petals Ø32 at distance 38, face 60, dot eyes to the side, o-mouth", () => {
    const g = bloomGeometry("wartet", 3);
    expect(g.petals).toHaveLength(8);
    expect(g.petals[0]).toEqual({ x: -16, y: -54, d: 32, light: false });
    expect(g.face).toEqual({ d: 60, sad: false, visible: true });
    expect([g.eyes, g.eyeL, g.eyeR, g.mouth]).toEqual(["dot", -10, 10, "o"]);
    expect(g.head).toEqual({ x: 150, y: 112, rotate: 0 });
    expect(g.stem).toBe("M150 336 L150 112");
  });

  it("leaves alternate right/left, get smaller and climb 26 px", () => {
    const [a, b, c] = bloomGeometry("froh", 3).leaves;
    expect(a).toMatchObject({ x: 153, y: 304, w: 56, h: 28, rotate: -30, originX: 153, originY: 318, light: false });
    expect(b).toMatchObject({ x: 95, y: 279, w: 52, h: 26, rotate: 30, originX: 147, originY: 292, light: true });
    expect(c).toMatchObject({ w: 48, y: 266 - 12 });
  });

  it("sad: the head hangs (182/148, 24°), pale petals turned, leaves droop, one wilted, a petal on the floor", () => {
    const g = bloomGeometry("traurig", 3, 1);
    expect(g.head).toEqual({ x: 182, y: 148, rotate: 24 });
    expect(g.stem).toBe("M150 336 C150 260, 150 200, 182 148");
    expect(g.petals).toHaveLength(6);
    expect(g.leaves.map((l) => [l.rotate, l.dead])).toEqual([
      [8, false],
      [-40, true],
      [8, false],
    ]);
    expect([g.brows, g.tear, g.mouth, g.fallen]).toEqual([true, true, "frown", true]);
  });

  it("sleeps: a closed bud, closed eyes, z z", () => {
    const g = bloomGeometry("schlaeft", 0);
    expect([g.bud, g.zzz, g.eyes, g.face.visible, g.petals.length]).toEqual([true, true, "closed", false, 0]);
  });

  it("blooms: 10 petals, big mouth, blush, four sparkles", () => {
    const g = bloomGeometry("blueht", 5);
    expect([g.petals.length, g.mouth, g.blush, g.sparkles.length]).toEqual([10, "big", true, 4]);
  });

  it("never more than five leaves", () => {
    expect(bloomGeometry("froh", 9).leaves).toHaveLength(5);
  });
});

describe("bloomLeaves", () => {
  it("the last five rounds, the latest skipped one wilted", () => {
    expect(bloomLeaves(["done", "done", "skipped", "done", "done", "skipped", "done"])).toEqual({ blaetter: 5, welk: 3 });
    expect(bloomLeaves(["done", "done"])).toEqual({ blaetter: 2, welk: -1 });
    expect(bloomLeaves([])).toEqual({ blaetter: 0, welk: -1 });
  });
});

describe("bloomStimmung (§3)", () => {
  it("follows the round", () => {
    expect(bloomStimmung({ round: "erlebt", livedHoursAgo: 3, lastRoundSkipped: false })).toBe("blueht");
    expect(bloomStimmung({ round: "erlebt", livedHoursAgo: 30, lastRoundSkipped: false })).toBe("schlaeft");
    expect(bloomStimmung({ round: "bestaetigt", lastRoundSkipped: true })).toBe("froh");
    expect(bloomStimmung({ round: "eingeladen", lastRoundSkipped: true })).toBe("wartet");
    expect(bloomStimmung({ round: "offen", lastRoundSkipped: true, hoursLeft: 80 })).toBe("traurig");
    expect(bloomStimmung({ round: "offen", lastRoundSkipped: false, hoursLeft: 11 })).toBe("traurig");
    expect(bloomStimmung({ round: "offen", lastRoundSkipped: false, hoursLeft: 40 })).toBe("schlaeft");
    expect(bloomStimmung({ round: "ausgefallen", lastRoundSkipped: false })).toBe("traurig");
  });
});

describe("bloomSaying", () => {
  it("knows whose move it is: no 'wer gießt?'", () => {
    expect(bloomSaying("schlaeft", 0, { partner: "Lotte", turn: "me" })).toBe("neue woche, neues glück. du gießt!");
    expect(bloomSaying("schlaeft", 0, { partner: "Lotte", turn: "partner" })).toBe("neue woche, neues glück. lotte gießt.");
  });
  it("speaks of the missed round when that is why it is sad", () => {
    expect(bloomSaying("traurig", 4, { partner: "Lotte", missed: true })).toBe("psst … letztes mal fiel's aus. heute vielleicht?");
    expect(bloomSaying("traurig", 4, { partner: "Lotte", missed: false })).not.toContain("fiel's aus");
  });
  it("names the partner and the day in lower case", () => {
    expect(bloomSaying("wartet", 0, { partner: "Lotte" })).toBe("lotte guckt grad … daumen drücken.");
    expect(bloomSaying("froh", 0, { partner: "Lotte", day: "Donnerstag" })).toBe("juhu, wasser! donnerstag wird schön.");
  });
});

describe("pots", () => {
  it("unlock at 10 and 25 lived dates", () => {
    expect(unlockedPots(0)).toEqual(["terrakotta"]);
    expect(unlockedPots(10)).toEqual(["terrakotta", "blau"]);
    expect(unlockedPots(25)).toEqual(["terrakotta", "blau", "gelb"]);
  });
  it("a locked or unknown choice draws terracotta", () => {
    expect(shownPot("gelb", 12)).toBe("terrakotta");
    expect(shownPot("blau", 12)).toBe("blau");
    expect(shownPot(null, 30)).toBe("terrakotta");
  });
});
