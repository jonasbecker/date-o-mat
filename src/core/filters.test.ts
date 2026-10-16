import { describe, expect, it } from "vitest";
import { activeFilterCount, filterPrompt, filterSummary, matchesIdeaFilter, parseFilter } from "./filters";

describe("parseFilter", () => {
  it("keeps known values only", () => {
    expect(parseFilter('{"size":"small","budget":"free","setting":"outdoor"}')).toEqual({ size: "small", budget: "free", setting: "outdoor" });
    expect(parseFilter('{"size":"huge","budget":1,"x":"y"}')).toEqual({});
    expect(parseFilter("not json")).toEqual({});
    expect(parseFilter(null)).toEqual({});
  });
});

describe("matchesIdeaFilter", () => {
  it("no filter: everything", () => {
    expect(matchesIdeaFilter({ size: "large", costEur: 90, setting: "indoor" }, {})).toBe(true);
  });
  it("size and setting; unknown passes", () => {
    expect(matchesIdeaFilter({ size: "large" }, { size: "small" })).toBe(false);
    expect(matchesIdeaFilter({ size: null }, { size: "small" })).toBe(true);
    expect(matchesIdeaFilter({ setting: "indoor" }, { setting: "outdoor" })).toBe(false);
    expect(matchesIdeaFilter({}, { setting: "outdoor" })).toBe(true);
  });
  it("Gratis needs to know it is free, Günstig lets unknown prices through", () => {
    expect(matchesIdeaFilter({ costEur: 0 }, { budget: "free" })).toBe(true);
    expect(matchesIdeaFilter({ free: true }, { budget: "free" })).toBe(true);
    expect(matchesIdeaFilter({ costEur: null }, { budget: "free" })).toBe(false);
    expect(matchesIdeaFilter({ costEur: 20 }, { budget: "cheap" })).toBe(true);
    expect(matchesIdeaFilter({ costEur: 21 }, { budget: "cheap" })).toBe(false);
    expect(matchesIdeaFilter({ costEur: null }, { budget: "cheap" })).toBe(true);
  });
});

describe("summary, count, prompt", () => {
  const f = { size: "small", budget: "free" } as const;
  it("works", () => {
    expect(activeFilterCount(f)).toBe(2);
    expect(filterSummary(f)).toBe("☕ Kurz · 🆓 Gratis");
    expect(filterSummary({})).toBe("");
    expect(filterPrompt(f)).toEqual(["All ideas must be small dates (up to about 3 hours).", "All ideas must be free (0 euros)."]);
  });
});
