import { describe, expect, it } from "vitest";
import { CURATED_IDEAS, filterCurated } from "./curated-ideas";
import { pickSurprise, type SurpriseCandidate } from "./surprise";

const c = (key: string, fromWishlist = false, size: "small" | "large" = "small"): SurpriseCandidate => ({ key, title: key, size, fromWishlist });

describe("pickSurprise", () => {
  it("wishlist ideas weigh double", () => {
    const pool = [c("eigen", true), c("koeln")];
    // weights 2 + 1 → [0, 2/3) is the wishlist idea, [2/3, 1) the Köln idea
    expect(pickSurprise(pool, { random: () => 0.6 })?.key).toBe("eigen");
    expect(pickSurprise(pool, { random: () => 0.7 })?.key).toBe("koeln");
  });
  it("does not repeat recent picks while there is something else", () => {
    expect(pickSurprise([c("a"), c("b")], { recent: ["a"], random: () => 0 })?.key).toBe("b");
    expect(pickSurprise([c("a")], { recent: ["a"], random: () => 0 })?.key).toBe("a");
  });
  it("can be limited to a size", () => {
    expect(pickSurprise([c("klein"), c("gross", false, "large")], { size: "large", random: () => 0 })?.key).toBe("gross");
  });
  it("null when there is nothing", () => {
    expect(pickSurprise([])).toBeNull();
  });
  it("roughly matches the weights over many draws", () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const counts = { eigen: 0, koeln: 0 } as Record<string, number>;
    for (let i = 0; i < 3000; i++) counts[pickSurprise([c("eigen", true), c("koeln")], { random })!.key]++;
    expect(counts.eigen / 3000).toBeGreaterThan(0.6);
    expect(counts.eigen / 3000).toBeLessThan(0.73);
  });
});

describe("curated ideas", () => {
  it("have unique ids and sensible data", () => {
    const ids = CURATED_IDEAS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CURATED_IDEAS.length).toBeGreaterThanOrEqual(40);
    for (const idea of CURATED_IDEAS) {
      expect(idea.title.length).toBeLessThanOrEqual(120);
      expect(idea.note.length).toBeLessThanOrEqual(1000);
      expect(idea.costEur).toBeGreaterThanOrEqual(0);
    }
  });
  it("filter by size, setting and budget", () => {
    const free = filterCurated(CURATED_IDEAS, { maxCostEur: 0, setting: "outdoor" });
    expect(free.length).toBeGreaterThan(3);
    expect(free.every((i) => i.costEur === 0 && i.setting === "outdoor")).toBe(true);
    expect(filterCurated(CURATED_IDEAS, { size: "large" }).every((i) => i.size === "large")).toBe(true);
  });
});
