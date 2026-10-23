import { describe, expect, it } from "vitest";
import { againChip, againReaction, archiveLeaves, LEAF, monthGroups, stemLayout, type ArchiveDateIn } from "./archive";

const date = (id: string, at: string, again: [string | null, string | null] = [null, null], photos = 0): ArchiveDateIn => ({
  id,
  title: `Date ${id}`,
  startsAt: new Date(at),
  endsAt: new Date(new Date(at).getTime() + 3_600_000),
  plannerId: "j",
  location: null,
  costEur: null,
  reviews: [
    ...(again[0] ? [{ userId: "j", rating: null, note: null, again: again[0] as "yes" }] : []),
    ...(again[1] ? [{ userId: "s", rating: null, note: null, again: again[1] as "yes" }] : []),
  ],
  photoIds: Array.from({ length: photos }, (_, i) => `${id}-p${i}`),
  motif: "herz",
});

describe("archive", () => {
  it("newest first, Nº from the oldest, wilted rounds in between with their week", () => {
    const leaves = archiveLeaves(
      [date("a", "2026-08-16T16:00:00Z"), date("b", "2026-10-22T17:00:00Z")],
      [{ id: "w", startsAt: new Date("2026-10-05T00:00:00Z"), plannerId: "s", title: "Bouldern", plannedAt: new Date("2026-10-07T17:00:00Z") }],
      "j",
    );
    expect(leaves.map((l) => [l.id, l.nr, l.kind])).toEqual([
      ["b", 3, "date"],
      ["w", 2, "wilt"],
      ["a", 1, "date"],
    ]);
    expect(leaves[1]).toMatchObject({ day: "Woche 41", chip: { text: "ausgefallen" }, href: "/dates/runde/w", monthLabel: "OKTOBER" });
    expect(leaves[0]).toMatchObject({ day: "Do 22.10.", href: "/dates/b" });
  });

  it("chips: both unbedingt, one nö, else vielleicht – the other one's answer only after your own", () => {
    const r = (a: string | null, b: string | null) => date("x", "2026-10-01T10:00:00Z", [a, b]).reviews;
    expect(againChip(r("yes", "yes"), "j")).toEqual({ text: "♥ nochmal: beide", tone: "both", both: true });
    expect(againChip(r("yes", "no"), "j").text).toBe("einmal reicht");
    expect(againChip(r("yes", "maybe"), "j").text).toBe("nochmal: vielleicht");
    // Sam answered, Jonas not yet: Sam's "nö" stays hidden from Jonas.
    expect(againChip(r(null, "no"), "j").text).toBe("nochmal: vielleicht");
  });

  it("stem: a month mark, then leaves alternating, 26 between, 38 after a mark, wilted ones 96 high", () => {
    const leaves = archiveLeaves(
      [date("a", "2026-09-25T16:00:00Z"), date("b", "2026-10-22T17:00:00Z"), date("c", "2026-10-16T17:00:00Z")],
      [{ id: "w", startsAt: new Date("2026-10-05T00:00:00Z"), plannerId: null, title: null, plannedAt: null }],
      "j",
    );
    const { marks, items, height } = stemLayout(leaves);
    expect(marks).toEqual([
      { top: 0, label: "OKTOBER" },
      { top: 38 + 150 + 26 + 150 + 26 + 96 + 26, label: "SEPTEMBER" },
    ]);
    expect(items.map((i) => [i.leaf.id, i.top, i.height, i.side])).toEqual([
      ["b", 38, 150, "left"],
      ["c", 38 + 176, 150, "right"],
      ["w", 38 + 352, 96, "left"],
      ["a", marks[1].top + 38, 150, "right"],
    ]);
    expect(height).toBe(marks[1].top + 38 + LEAF.photo);
    expect(items[2].leaf.title).toBe("Runde ohne Date");
  });

  it("grid: month groups with 1 Blatt / n Blätter", () => {
    const leaves = archiveLeaves([date("a", "2026-09-25T16:00:00Z"), date("b", "2026-10-22T17:00:00Z"), date("c", "2026-10-16T17:00:00Z")], [], "j");
    expect(monthGroups(leaves).map((g) => [g.label, g.count, g.leaves.length])).toEqual([
      ["OKTOBER", "2 Blätter", 2],
      ["SEPTEMBER", "1 Blatt", 1],
    ]);
  });

  it("the flower takes the answer (ARCHIV.md §3)", () => {
    expect(againReaction(null)).toEqual({ mood: "wartet", welk: -1, quip: "und? erzähl! ich war ja nicht dabei." });
    expect(againReaction("no")).toMatchObject({ mood: "traurig", welk: 1 });
    expect(againReaction("maybe").mood).toBe("froh");
    expect(againReaction("yes")).toMatchObject({ mood: "blueht", quip: "JAAA! ich blüh gleich mit." });
  });
});
