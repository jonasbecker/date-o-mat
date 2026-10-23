import { describe, expect, it } from "vitest";
import { CATEGORY_VIEW, chipsFor, groupIdeas, ideaCount, ideaMeta, tipOrder, type TipIdea } from "./idea-category";

const NOW = Date.parse("2026-10-23T10:00:00Z");
const DAY = 86_400_000;
const idea = (id: string, over: Partial<TipIdea> = {}): TipIdea => ({ id, slotStart: null, partnerLiked: false, lastPlannedAt: null, createdAt: 0, ...over });

describe("category view", () => {
  it("every kind has a title with a dot, a subtitle and quips", () => {
    for (const view of Object.values(CATEGORY_VIEW)) {
      expect(view.title).toMatch(/\.$/);
      expect(view.subtitle).not.toBe("");
      expect(view.quips.length).toBeGreaterThan(0);
    }
    expect(ideaCount(1)).toBe("1 Idee");
    expect(ideaCount(39)).toBe("39 Ideen");
  });

  it("chips: counts, empty ones and the view's own dimension left out, 'alle' always", () => {
    const ideas = [
      { size: "small" as const, costEur: 0, setting: "outdoor" as const },
      { size: "small" as const, costEur: 20, setting: null },
    ];
    expect(chipsFor("all", ideas)).toEqual([
      { chip: "all", count: 2 },
      { chip: "free", count: 1 },
      { chip: "evening", count: 2 },
      { chip: "outdoor", count: 1 },
    ]);
    expect(chipsFor("small", ideas).map((c) => c.chip)).toEqual(["all", "free", "outdoor"]);
    expect(chipsFor("outdoor", ideas).map((c) => c.chip)).toEqual(["all", "free", "evening"]);
    expect(chipsFor("all", [])).toEqual([{ chip: "all", count: 0 }]);
  });

  it("tip order: this week first, then the other one's likes, then longest not planned, then oldest", () => {
    const ordered = tipOrder(
      [
        idea("later-liked", { partnerLiked: true }),
        idea("week-old-plan", { slotStart: NOW + DAY, lastPlannedAt: NOW - 30 * DAY }),
        idea("week-never", { slotStart: NOW + 2 * DAY, createdAt: 5 }),
        idea("week-never-older", { slotStart: NOW + 3 * DAY, createdAt: 1 }),
        idea("week-liked", { slotStart: NOW + 5 * DAY, partnerLiked: true, lastPlannedAt: NOW - DAY }),
        idea("next-month", { slotStart: NOW + 20 * DAY }),
      ],
      NOW,
    );
    expect(ordered.map((i) => i.id)).toEqual(["week-liked", "week-never-older", "week-never", "week-old-plan", "later-liked", "next-month"]);
  });

  it("groups: the tip is not listed again, this week soonest first", () => {
    const ideas = [idea("a", { slotStart: NOW + 3 * DAY }), idea("b", { slotStart: NOW + DAY }), idea("c"), idea("d", { slotStart: NOW + 9 * DAY })];
    const { week, later } = groupIdeas(ideas, "a", NOW);
    expect(week.map((i) => i.id)).toEqual(["b"]);
    expect(later.map((i) => i.id)).toEqual(["c", "d"]);
  });

  it("meta: how long · cost · place up to its comma", () => {
    expect(ideaMeta({ size: "small", costEur: 0, location: "Rheinauhafen, Köln" })).toBe("ein Abend · gratis · Rheinauhafen");
    expect(ideaMeta({ size: "large", costEur: 40, location: null })).toBe("halber Tag · ~40 €");
    expect(ideaMeta({ size: "small", costEur: null, location: "" })).toBe("ein Abend");
  });
});
