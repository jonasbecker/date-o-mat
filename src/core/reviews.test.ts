import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { parseReview, reviewAskAt, reviewStats, visibleRatings, visibleReviews, type StatsDate } from "./reviews";

const ZONE = "Europe/Berlin";
const at = (s: string) => DateTime.fromISO(s, { zone: ZONE }).toJSDate();
const show = (d: Date) => DateTime.fromJSDate(d, { zone: ZONE }).toFormat("yyyy-LL-dd HH:mm");

describe("reviewAskAt", () => {
  it("asks the next day at 11:00", () => {
    expect(show(reviewAskAt({ startsAt: at("2026-10-16T19:00"), endsAt: at("2026-10-16T22:00") }))).toBe("2026-10-17 11:00");
  });
  it("waits until an hour after a very long date", () => {
    expect(show(reviewAskAt({ startsAt: at("2026-10-16T08:00"), endsAt: at("2026-10-17T10:30") }))).toBe("2026-10-17 11:30");
  });
  it("keeps 11:00 local time across the DST change", () => {
    expect(show(reviewAskAt({ startsAt: at("2026-10-24T19:00"), endsAt: at("2026-10-24T22:00") }))).toBe("2026-10-25 11:00");
  });
});

describe("parseReview", () => {
  it("needs nochmal?, trims the note, hearts are optional", () => {
    expect(parseReview({ note: "  schön  ", again: "yes" })).toEqual({ rating: null, note: "schön", again: "yes" });
    expect(parseReview({ rating: "4", note: "", again: "maybe" })).toEqual({ rating: 4, note: null, again: "maybe" });
  });
  it("without a valid nochmal? there is nothing to save", () => {
    expect(parseReview({ rating: 5, note: "toll" })).toBeNull();
    expect(parseReview({ note: "", again: "egal" })).toBeNull();
  });
  it("hearts out of range or not whole are dropped, not an error", () => {
    for (const rating of ["0", "6", "3.5", ""]) expect(parseReview({ rating, note: "", again: "no" })?.rating).toBeNull();
  });
  it("cuts very long notes", () => {
    expect(parseReview({ note: "x".repeat(900), again: "yes" })?.note).toHaveLength(500);
  });
});

describe("visibleReviews", () => {
  const jonas = { userId: "jonas", rating: 5, note: "toll" };
  const sam = { userId: "sam", rating: 4, note: null };

  it("hides the partner's review until you wrote yours", () => {
    expect(visibleReviews([sam], "jonas")).toEqual({ mine: null, partner: null, partnerHidden: true });
  });
  it("shows both once you reviewed", () => {
    expect(visibleReviews([jonas, sam], "jonas")).toEqual({ mine: jonas, partner: sam, partnerHidden: false });
  });
  it("nothing hidden when nobody reviewed", () => {
    expect(visibleReviews([], "jonas")).toEqual({ mine: null, partner: null, partnerHidden: false });
  });
});

describe("visibleRatings", () => {
  it("hides the partner's hearts from averages until you reviewed", () => {
    expect(visibleRatings([{ userId: "sam", rating: 2, note: null }], "jonas")).toEqual([]);
    expect(visibleRatings([{ userId: "sam", rating: 2, note: null }, { userId: "jonas", rating: 5, note: null }], "jonas")).toEqual([5, 2]);
  });
});

describe("reviewStats", () => {
  const date = (id: string, start: string, ratings: number[]): StatsDate => ({ id, title: id, startsAt: at(start), ratings });

  it("counts dates, averages all hearts and picks the favorite", () => {
    const stats = reviewStats(
      [date("kino", "2026-10-02T19:00", [4, 5]), date("picknick", "2025-08-01T12:00", [5, 5]), date("bowling", "2026-09-01T19:00", [])],
      at("2026-10-14T12:00"),
    );
    expect(stats).toEqual({ count: 3, averageRating: 4.8, favorite: { id: "picknick", title: "picknick", average: 5 }, thisYear: 2 });
  });
  it("on a tie the more recent date wins", () => {
    const stats = reviewStats([date("alt", "2026-01-01T19:00", [5]), date("neu", "2026-06-01T19:00", [5])], at("2026-10-14T12:00"));
    expect(stats.favorite?.id).toBe("neu");
  });
  it("is empty without dates", () => {
    expect(reviewStats([], at("2026-10-14T12:00"))).toEqual({ count: 0, averageRating: null, favorite: null, thisYear: 0 });
  });
});
