import { describe, expect, it } from "vitest";
import {
  buildDeckPrompt,
  cleanDeckCards,
  comboCount,
  DECK_THEMES,
  dedupeKey,
  isNearDuplicate,
  curatedForDeck,
  matchesFilter,
  maybeRevisitAt,
  needsRefill,
  orderDeck,
  pickThemes,
  revisitOutcome,
  seasonOf,
  superLikeLeft,
  swipeOutcome,
  titleWords,
  type RawDeckCard,
} from "./deck";

describe("no repeats", () => {
  it("titleWords drops emoji, punctuation and filler words", () => {
    expect(titleWords("🍜 Ramen-Abend im Belgischen Viertel!")).toEqual(["ramen", "abend", "belgischen", "viertel"]);
  });
  it("dedupeKey is order independent", () => {
    expect(dedupeKey("Picknick im Stadtwald")).toBe(dedupeKey("Stadtwald: Picknick"));
  });
  it.each([
    ["Picknick im Stadtwald", "Stadtwald-Picknick", true],
    ["Picknick im Stadtwald mit Decke", "Picknick Stadtwald", true],
    ["Kino: Dune", "Bouldern in Ehrenfeld", false],
    ["Kochabend: Ramen", "Ramen essen gehen", false],
  ])("%s ~ %s → %s", (a, b, dup) => expect(isNearDuplicate(dedupeKey(a), [dedupeKey(b)])).toBe(dup));
});

describe("variety", () => {
  it("rotates through all themes", () => {
    const seen = new Set([0, 1, 2].flatMap((b) => pickThemes(b).map((t) => t.key)));
    expect(seen.size).toBe(DECK_THEMES.length);
    expect(pickThemes(0)).toHaveLength(4);
  });
  it("season in Berlin", () => {
    expect(seasonOf(new Date("2026-10-14T12:00:00Z")).de).toBe("Herbst");
    expect(seasonOf(new Date("2026-02-28T23:30:00Z")).de).toBe("Frühling"); // already 1 March in Berlin
  });
  it("combo count follows the setting and the events available", () => {
    expect(comboCount("none", 10)).toBe(0);
    expect(comboCount("some", 10)).toBe(3);
    expect(comboCount("lots", 2)).toBe(2);
  });
});

describe("buildDeckPrompt", () => {
  const base = {
    now: new Date("2026-10-14T12:00:00Z"),
    weather: "9–13 °C, trocken",
    themes: pickThemes(0),
    ideaCount: 17,
    events: [{ title: "Konzert: Annenmaykantereit", when: "Fr 16.10. 20:00", venue: "Palladium", price: "45 €" }],
    comboCount: 1,
    liked: ["Kino: Dune"],
    passed: ["Museum Ludwig"],
    exclude: ["Picknick im Stadtwald"],
  };
  it("contains season, weather, themes, events, taste and the exclude list", () => {
    const prompt = buildDeckPrompt(base);
    expect(prompt).toContain("(autumn)");
    expect(prompt).toContain("9–13 °C, trocken");
    expect(prompt).toContain("Make 17 normal ideas");
    expect(prompt).toContain("0: Konzert: Annenmaykantereit – Fr 16.10. 20:00 – Palladium – 45 €");
    expect(prompt).toContain("They liked: Kino: Dune");
    expect(prompt).toContain("They swiped away: Museum Ludwig");
    expect(prompt).toContain("Exclude list (already seen or on their list): Picknick im Stadtwald");
    expect(prompt).toContain("wildcards");
  });
  it("filter focus and budget", () => {
    const prompt = buildDeckPrompt({ ...base, focus: { budget: "cheap", setting: "indoor" }, budgetLeft: 5, comboCount: 0 });
    expect(prompt).toContain("must be cheap");
    expect(prompt).toContain("indoors");
    expect(prompt).toContain("nearly used up");
    expect(prompt).not.toContain("combo cards");
  });
});

const raw = (over: Partial<RawDeckCard>): RawDeckCard => ({
  title: "Sterne gucken am Rhein",
  description: "Decke, Tee, Himmel.",
  emoji: "✨",
  size: "small",
  cost_eur: 0,
  location: "Rheinpark",
  setting: "outdoor",
  theme: "romantic",
  wildcard: false,
  event_index: null,
  ...over,
});

describe("cleanDeckCards", () => {
  it("normalizes values and drops near-duplicates of each other and of old cards", () => {
    const cards = cleanDeckCards(
      [
        raw({ cost_eur: 12.6, size: "huge", setting: "space", theme: "unknown", emoji: "abc" }),
        raw({ title: "Am Rhein Sterne gucken" }),
        raw({ title: "Picknick im Stadtwald" }),
        raw({ title: "  " }),
      ],
      { existingKeys: [dedupeKey("Stadtwald Picknick")], eventCount: 0, maxCombos: 0 },
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ kind: "idea", costEur: 13, size: "small", setting: null, theme: null, emoji: null });
  });
  it("combo cards: valid index, each event once, at most maxCombos", () => {
    const cards = cleanDeckCards(
      [raw({ title: "Konzert + Burger", event_index: 0 }), raw({ title: "Konzert + Cocktails", event_index: 0 }), raw({ title: "Lesung danach Wein", event_index: 5 }), raw({ title: "Theater + Pasta", event_index: 1 })],
      { existingKeys: [], eventCount: 2, maxCombos: 1 },
    );
    expect(cards.map((c) => [c.title, c.kind, c.eventIndex])).toEqual([["Konzert + Burger", "combo", 0]]);
  });
});

describe("swiping", () => {
  it.each([
    ["nope", "like", "pass"],
    ["like", null, "wait"],
    ["like", "nope", "wait"],
    ["like", "like", "match"],
    ["super", "like", "match"],
    ["like", "super", "match"],
    ["maybe", "like", "wait"],
  ] as const)("%s + partner %s → %s", (mine, partner, outcome) => expect(swipeOutcome(mine, partner)).toBe(outcome));

  it("orders partner super-likes, then partner likes, then combos by date, then oldest", () => {
    const t = (d: number) => new Date(Date.UTC(2026, 9, d));
    const cards = [
      { id: "old", createdAt: t(1), eventStartsAt: null },
      { id: "new", createdAt: t(5), eventStartsAt: null },
      { id: "combo-late", createdAt: t(5), eventStartsAt: t(20) },
      { id: "combo-soon", createdAt: t(6), eventStartsAt: t(16) },
      { id: "liked", createdAt: t(7), eventStartsAt: null },
      { id: "super", createdAt: t(8), eventStartsAt: null },
    ];
    const partner = new Map([
      ["liked", "like" as const],
      ["super", "super" as const],
      ["old", "nope" as const],
    ]);
    expect(orderDeck(cards, partner).map((c) => c.id)).toEqual(["super", "liked", "combo-soon", "combo-late", "old", "new"]);
  });

  it("filters", () => {
    const card = { kind: "idea" as const, costEur: 10, setting: "indoor" as const, size: "small" as const };
    expect(matchesFilter(card, { budget: "cheap" })).toBe(true);
    expect(matchesFilter({ ...card, costEur: null }, { budget: "free" })).toBe(false);
    expect(matchesFilter(card, { setting: "outdoor" })).toBe(false);
    expect(matchesFilter(card, { size: "large" })).toBe(false);
    expect(matchesFilter(card, { size: "small", setting: "indoor" })).toBe(true);
  });

  it("one super-like per Berlin day", () => {
    const now = new Date("2026-10-14T22:30:00Z"); // 00:30 on the 15th in Berlin
    expect(superLikeLeft(null, now)).toBe(true);
    expect(superLikeLeft(new Date("2026-10-14T21:00:00Z"), now)).toBe(true); // 23:00 on the 14th
    expect(superLikeLeft(new Date("2026-10-14T22:10:00Z"), now)).toBe(false);
  });

  it("refills when someone runs low – within limits", () => {
    expect(needsRefill({ remainingPerPerson: [12, 4], openTotal: 20, autoBatchesToday: 0 })).toBe(true);
    expect(needsRefill({ remainingPerPerson: [12, 8], openTotal: 20, autoBatchesToday: 0 })).toBe(false);
    expect(needsRefill({ remainingPerPerson: [0, 0], openTotal: 0, autoBatchesToday: 3 })).toBe(false);
    expect(needsRefill({ remainingPerPerson: [60, 0], openTotal: 60, autoBatchesToday: 0 })).toBe(false);
  });
});

describe("maybe and revisit", () => {
  const now = new Date("2026-10-14T12:00:00Z"); // autumn
  it("a maybe comes back at the start of its season, else in three weeks", () => {
    expect(maybeRevisitAt("summer", now).toISOString()).toBe("2027-06-01T06:00:00.000Z");
    expect(maybeRevisitAt("winter", now).toISOString()).toBe("2026-12-01T07:00:00.000Z");
    expect(maybeRevisitAt("autumn", now).toISOString()).toBe("2026-11-04T07:00:00.000Z");
    expect(maybeRevisitAt(null, now).toISOString()).toBe("2026-11-04T07:00:00.000Z");
  });
  it.each([
    ["like", null, "keep"],
    ["nope", null, "wait"],
    ["nope", "nope", "archive"],
    ["nope", "like", "wait"],
    ["maybe", "nope", "wait"],
  ] as const)("revisit: %s + partner %s → %s", (mine, partner, outcome) => expect(revisitOutcome(mine, partner)).toBe(outcome));
  it("best_season is checked", () => {
    const [card] = cleanDeckCards([raw({ best_season: "summer" })], { existingKeys: [], eventCount: 0, maxCombos: 0 });
    expect(card.bestSeason).toBe("summer");
    expect(cleanDeckCards([raw({ best_season: "monsoon" })], { existingKeys: [], eventCount: 0, maxCombos: 0 })[0].bestSeason).toBeNull();
  });
});

describe("curatedForDeck", () => {
  const curated = [
    { id: "a", title: "Picknick im Stadtwald", size: "small", costEur: 10, location: "Lindenthal", setting: "outdoor", note: "Decke mit." },
    { id: "b", title: "Museum Ludwig", size: "small", costEur: 0, location: "Altstadt", setting: "indoor", note: "Pop-Art." },
    { id: "c", title: "Kanu auf der Sieg", size: "large", costEur: 60, location: "Siegburg", setting: "outdoor", note: "Ganzer Tag." },
  ] as const;
  it("skips what is already there, a few at a time", () => {
    const cards = curatedForDeck(curated, [dedupeKey("Picknick im Stadtwald")], 1);
    expect(cards.map((c) => c.title)).toEqual(["Museum Ludwig"]);
    expect(cards[0]).toMatchObject({ kind: "idea", emoji: "📍", setting: "indoor", theme: "free", costEur: 0 });
    expect(curatedForDeck(curated, [], 5)).toHaveLength(3);
  });
});
