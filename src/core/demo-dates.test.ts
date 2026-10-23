import { describe, expect, it } from "vitest";
import { DEMO_DATES, DEMO_MIN_AGE_DAYS, demoPhotoPath, demoPhotoSeed, demoPhotoSvg, demoRounds } from "./demo-dates";
import { RATING_MAX, RATING_MIN } from "@/lib/domain";

const NOW = new Date("2026-10-22T18:00:00Z");

describe("demo dates", () => {
  it("one round per week back, Monday to Monday, each date inside its round", () => {
    const rounds = demoRounds(NOW);
    expect(rounds).toHaveLength(DEMO_DATES.length + 1);
    expect(new Set(rounds.map((r) => r.weeksAgo)).size).toBe(rounds.length);
    for (const r of rounds) {
      expect(r.endsAt.getTime() - r.startsAt.getTime()).toBeGreaterThanOrEqual(167 * 3_600_000);
      if (r.date) {
        expect(r.date.startsAt >= r.startsAt && r.date.endsAt <= r.endsAt).toBe(true);
      }
    }
    // Oldest first.
    expect(rounds[0].weeksAgo).toBeGreaterThan(rounds.at(-1)!.weeksAgo);
  });

  it("all of it is older than the 'wie war's?' window – no reminder ever comes from a test date", () => {
    for (const r of demoRounds(NOW)) if (r.date) expect(NOW.getTime() - r.date.endsAt.getTime()).toBeGreaterThan(DEMO_MIN_AGE_DAYS * 86_400_000);
  });

  it("shows what the Archiv can: both reviews, one, none; photos; a checklist; a round that fell through", () => {
    expect(DEMO_DATES.some((d) => d.reviews.length === 2)).toBe(true);
    expect(DEMO_DATES.some((d) => d.reviews.length === 1)).toBe(true);
    expect(DEMO_DATES.some((d) => d.reviews.length === 0)).toBe(true);
    expect(DEMO_DATES.some((d) => d.photos > 1)).toBe(true);
    expect(DEMO_DATES.some((d) => d.tasks.length > 0)).toBe(true);
    expect(demoRounds(NOW).some((r) => r.date === null)).toBe(true);
    for (const d of DEMO_DATES) for (const r of d.reviews) expect(r.rating >= RATING_MIN && r.rating <= RATING_MAX).toBe(true);
  });

  it("drawn photos: a path the photo route knows, a picture", () => {
    expect(demoPhotoSeed(demoPhotoPath(7))).toBe(7);
    expect(demoPhotoSeed("couple/abc/photo.jpg")).toBeNull();
    expect(demoPhotoSvg(3)).toMatch(/^<svg [^>]*width="1200"/);
  });
});
