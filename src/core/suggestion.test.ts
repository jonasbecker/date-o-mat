import { describe, expect, it } from "vitest";
import type { Slot } from "./slots";
import { pickSuggestion, type IdeaChoice } from "./suggestion";

const slot = (iso: string, size: "small" | "large"): Slot => ({
  start: new Date(iso),
  end: new Date(new Date(iso).getTime() + 2 * 3_600_000),
  size,
  score: 1,
  mood: "evening",
});
const idea = (id: string, size: "small" | "large", added: string): IdeaChoice => ({
  ideaId: id,
  title: id,
  size,
  addedAt: new Date(added),
});

const small = [slot("2026-10-16T16:30:00Z", "small"), slot("2026-10-17T12:00:00Z", "small")];
const large = [slot("2026-10-18T08:00:00Z", "large")];
const ideas = [idea("kino", "small", "2026-09-10"), idea("picknick", "small", "2026-08-01"), idea("wandern", "large", "2026-07-01")];

describe("pickSuggestion", () => {
  it("takes the best small slot and the oldest small idea", () => {
    const s = pickSuggestion({ small, large, preferLarge: false, ideas, rejected: [] })!;
    expect(s.slot).toBe(small[0]);
    expect(s.idea?.ideaId).toBe("picknick");
  });

  it("prefers a large date when asked to", () => {
    const s = pickSuggestion({ small, large, preferLarge: true, ideas, rejected: [] })!;
    expect(s.slot.size).toBe("large");
    expect(s.idea?.ideaId).toBe("wandern");
  });

  it("skips rejected slots and ideas", () => {
    const rejected = [{ startsAt: small[0].start, size: "small" as const, ideaId: "picknick" }];
    const s = pickSuggestion({ small, large, preferLarge: false, ideas, rejected })!;
    expect(s.slot).toBe(small[1]);
    expect(s.idea?.ideaId).toBe("kino");
  });

  it("suggests a slot without idea when the wishlist has none of that size", () => {
    const s = pickSuggestion({ small, large: [], preferLarge: false, ideas: [ideas[2]], rejected: [] })!;
    expect(s.idea).toBeNull();
  });

  it("returns null when every slot was rejected", () => {
    const rejected = [...small, ...large].map((sl) => ({ startsAt: sl.start, size: sl.size, ideaId: null }));
    expect(pickSuggestion({ small, large, preferLarge: false, ideas, rejected })).toBeNull();
  });

  describe("outdoor ideas get a time that suits them", () => {
    // Plain ranking: Friday evening first. Outdoor ranking: Saturday afternoon first. Dark-is-fine: Friday evening.
    const friday = slot("2026-10-23T16:30:00Z", "small");
    const saturday = slot("2026-10-24T12:30:00Z", "small");
    const plain = { small: [friday, saturday], large: [] as Slot[] };
    const outdoor = { small: [saturday, friday], large: [] as Slot[] };
    const outdoorDark = { small: [friday, saturday], large: [] as Slot[] };
    const picnic: IdeaChoice = { ...idea("picknick", "small", "2026-08-01"), title: "Picknick im Stadtwald", setting: "outdoor" };
    const sushi: IdeaChoice = { ...idea("sushi", "small", "2026-09-01"), title: "Sushi-Abend", setting: "indoor" };

    it("the outdoor idea that waited longest gets the weekend afternoon", () => {
      const s = pickSuggestion({ ...plain, outdoor, outdoorDark, preferLarge: false, ideas: [sushi, picnic], rejected: [] })!;
      expect(s.idea?.ideaId).toBe("picknick");
      expect(s.slot).toBe(saturday);
    });

    it("an indoor idea keeps the Friday evening", () => {
      const s = pickSuggestion({ ...plain, outdoor, outdoorDark, preferLarge: false, ideas: [sushi], rejected: [] })!;
      expect(s.idea?.ideaId).toBe("sushi");
      expect(s.slot).toBe(friday);
    });

    it("ideas without a setting are ranked plainly", () => {
      const s = pickSuggestion({ ...plain, outdoor, outdoorDark, preferLarge: false, ideas: [{ ...picnic, setting: null }], rejected: [] })!;
      expect(s.slot).toBe(friday);
    });

    it("an outdoor idea that wants the dark (stars) uses the evening ranking", () => {
      const stars: IdeaChoice = { ...picnic, ideaId: "sterne", title: "Sterne gucken am Rhein" };
      const s = pickSuggestion({ ...plain, outdoor, outdoorDark, preferLarge: false, ideas: [stars], rejected: [] })!;
      expect(s.slot).toBe(friday);
    });

    it("\"Anderer Vorschlag\" moves on within the idea's own ranking", () => {
      const rejected = [{ startsAt: saturday.start, size: "small" as const, ideaId: "picknick" }];
      const s = pickSuggestion({ ...plain, outdoor, outdoorDark, preferLarge: false, ideas: [picnic, sushi], rejected })!;
      expect(s.idea?.ideaId).toBe("sushi");
      expect(s.slot).toBe(friday);
    });

    it("works with the old call without outdoor rankings", () => {
      const s = pickSuggestion({ ...plain, preferLarge: false, ideas: [picnic], rejected: [] })!;
      expect(s.slot).toBe(friday);
    });
  });
});

