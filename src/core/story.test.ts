import { describe, expect, it } from "vitest";
import { buildStory, storyYearToShow, swipeTaste, type StoryDate, type StoryInput } from "./story";

const people = [
  { id: "j", name: "Jonas" },
  { id: "s", name: "Sam" },
];
const date = (iso: string, over: Partial<StoryDate> = {}): StoryDate => {
  const start = new Date(iso);
  return { id: iso, title: `Date ${iso}`, startsAt: start, endsAt: new Date(start.getTime() + 2 * 3_600_000), size: "small", cost: 20, ratings: [], photoIds: [], ...over };
};
const input = (over: Partial<StoryInput> = {}): StoryInput => ({ year: 2026, dates: [], swipes: [], matchThemes: [], people, pot: null, ...over });

describe("buildStory", () => {
  it("empty year", () => {
    expect(buildStory(input())).toEqual([{ kind: "empty", year: 2026 }]);
  });

  it("all slides for a full year", () => {
    const slides = buildStory(
      input({
        dates: [
          date("2026-03-06T18:00:00Z", { title: "Kino", ratings: [4, 5], photoIds: ["p1"] }),
          date("2026-03-13T18:00:00Z", { title: "Bowling", ratings: [5, 5], cost: 30, photoIds: ["p2", "p3"] }),
          date("2026-07-10T08:00:00Z", { title: "Ausflug", size: "large", endsAt: new Date("2026-07-10T16:00:00Z"), ratings: [3], cost: null }),
        ],
        swipes: [{ userId: "j", verdict: "like", theme: "food" }],
        matchThemes: ["food", "nature"],
        pot: 45,
      }),
    );
    expect(slides.map((s) => s.kind)).toEqual(["intro", "count", "favorite", "hearts", "rhythm", "sizes", "money", "taste", "photos", "outro"]);
    expect(slides[1]).toEqual({ kind: "count", dates: 3, hours: 12 });
    expect(slides[2]).toMatchObject({ kind: "favorite", title: "Bowling", hearts: 5, photoId: "p2" });
    expect(slides[3]).toEqual({ kind: "hearts", average: 4.4, rated: 3 });
    expect(slides[4]).toEqual({ kind: "rhythm", topMonth: "März", topMonthDates: 2, weekday: "Freitag" });
    expect(slides[5]).toEqual({ kind: "sizes", short: 2, long: 1 });
    expect(slides[6]).toEqual({ kind: "money", total: 50, perDate: 25, pot: 45 });
    expect(slides[7]).toMatchObject({ kind: "taste", themes: ["Essen & Trinken", "Natur"], matches: 2, swipes: 1 });
    expect(slides[8]).toEqual({ kind: "photos", count: 3, photoIds: ["p1", "p2", "p3"] });
  });

  it("favorite: on a tie the more recent one", () => {
    const slides = buildStory(input({ dates: [date("2026-01-01T18:00:00Z", { title: "Alt", ratings: [5] }), date("2026-02-01T18:00:00Z", { title: "Neu", ratings: [5] })] }));
    expect(slides.find((s) => s.kind === "favorite")).toMatchObject({ title: "Neu" });
  });
});

describe("swipeTaste", () => {
  it("who swipes right more often (from 10 swipes each)", () => {
    const swipes = [
      ...Array.from({ length: 10 }, (_, i) => ({ userId: "j", verdict: i < 8 ? ("like" as const) : ("nope" as const), theme: "food" })),
      ...Array.from({ length: 10 }, (_, i) => ({ userId: "s", verdict: i < 4 ? ("like" as const) : ("nope" as const), theme: "culture" })),
    ];
    expect(swipeTaste({ swipes, matchThemes: [], people }).rightSwiper).toEqual({ name: "Jonas", percent: 80 });
    expect(swipeTaste({ swipes: swipes.slice(0, 15), matchThemes: [], people }).rightSwiper).toBeNull();
  });
});

describe("storyYearToShow", () => {
  it.each([
    ["2026-12-26T12:00:00Z", null],
    ["2026-12-27T12:00:00Z", 2026],
    ["2027-01-20T12:00:00Z", 2026],
    ["2027-02-01T12:00:00Z", null],
  ])("%s → %s", (iso, year) => expect(storyYearToShow(new Date(iso))).toBe(year));
});
