// "Eure Date-Story": a year in review to tap through (like a music app's
// year recap). Pure – the server collects dates, ratings, photos and swipes.

import { DateTime } from "luxon";
import { DECK_THEMES } from "./deck";
import { APP_TIMEZONE, type IdeaSize, type SwipeVerdict } from "@/lib/domain";

export type StoryDate = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  size: IdeaSize;
  /** Real amount, else the estimate, else null. */
  cost: number | null;
  /** Hearts this viewer may see (partner's only once both rated). */
  ratings: number[];
  photoIds: string[];
};

export type StorySwipe = { userId: string; verdict: SwipeVerdict; theme: string | null };

export type StoryInput = {
  year: number;
  /** Done dates of that year. */
  dates: StoryDate[];
  swipes: StorySwipe[];
  /** Themes of the matched deck cards that year. */
  matchThemes: Array<string | null>;
  people: Array<{ id: string; name: string }>;
  /** Savings pot at the end of the year (null = no budget). */
  pot: number | null;
};

export type Slide =
  | { kind: "intro"; year: number; names: [string, string] }
  | { kind: "count"; dates: number; hours: number }
  | { kind: "favorite"; title: string; hearts: number; dateId: string; photoId: string | null }
  | { kind: "hearts"; average: number; rated: number }
  | { kind: "rhythm"; topMonth: string; topMonthDates: number; weekday: string }
  | { kind: "sizes"; short: number; long: number }
  | { kind: "money"; total: number; perDate: number; pot: number | null }
  | { kind: "taste"; themes: string[]; matches: number; swipes: number; rightSwiper: { name: string; percent: number } | null }
  | { kind: "photos"; count: number; photoIds: string[] }
  | { kind: "outro"; year: number }
  | { kind: "empty"; year: number };

const THEME_LABEL = Object.fromEntries(DECK_THEMES.map((t) => [t.key, t.label])) as Record<string, string>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mostCommon<T>(items: T[]): { value: T; count: number } | null {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) if (!best || count > best.count) best = { value, count };
  return best;
}

export function buildStory(input: StoryInput, zone = APP_TIMEZONE): Slide[] {
  const { year, dates, people } = input;
  const names: [string, string] = [people[0]?.name ?? "", people[1]?.name ?? ""];
  if (dates.length === 0 && input.swipes.length === 0) return [{ kind: "empty", year }];
  const slides: Slide[] = [{ kind: "intro", year, names }];

  if (dates.length > 0) {
    const minutes = dates.reduce((sum, d) => sum + (d.endsAt.getTime() - d.startsAt.getTime()) / 60_000, 0);
    slides.push({ kind: "count", dates: dates.length, hours: Math.round(minutes / 60) });

    const rated = dates.filter((d) => d.ratings.length > 0).map((d) => ({ d, avg: d.ratings.reduce((a, b) => a + b, 0) / d.ratings.length }));
    if (rated.length > 0) {
      // Best average; on a tie the more recent one.
      const best = [...rated].sort((a, b) => b.avg - a.avg || b.d.startsAt.getTime() - a.d.startsAt.getTime())[0];
      slides.push({ kind: "favorite", title: best.d.title, hearts: round1(best.avg), dateId: best.d.id, photoId: best.d.photoIds[0] ?? null });
      const all = rated.flatMap((r) => r.d.ratings);
      slides.push({ kind: "hearts", average: round1(all.reduce((a, b) => a + b, 0) / all.length), rated: rated.length });
    }

    const local = dates.map((d) => DateTime.fromJSDate(d.startsAt, { zone }).setLocale("de"));
    const month = mostCommon(local.map((t) => t.month))!;
    const weekday = mostCommon(local.map((t) => t.weekday))!;
    slides.push({
      kind: "rhythm",
      topMonth: DateTime.fromObject({ year, month: month.value }, { zone }).setLocale("de").toFormat("LLLL"),
      topMonthDates: month.count,
      weekday: local.find((t) => t.weekday === weekday.value)!.toFormat("cccc"),
    });
    slides.push({ kind: "sizes", short: dates.filter((d) => d.size === "small").length, long: dates.filter((d) => d.size === "large").length });

    const costs = dates.map((d) => d.cost).filter((c): c is number => c !== null);
    if (costs.length > 0) {
      const total = costs.reduce((a, b) => a + b, 0);
      slides.push({ kind: "money", total, perDate: Math.round(total / costs.length), pot: input.pot });
    }
  }

  if (input.swipes.length > 0) {
    slides.push({ kind: "taste", ...swipeTaste(input) });
  }

  const photoIds = dates.flatMap((d) => d.photoIds);
  if (photoIds.length > 0) slides.push({ kind: "photos", count: photoIds.length, photoIds: photoIds.slice(0, 6) });
  slides.push({ kind: "outro", year });
  return slides;
}

/** "Euer Ding": favourite themes, matches, and who swipes right more often. */
export function swipeTaste(input: Pick<StoryInput, "swipes" | "matchThemes" | "people">): {
  themes: string[];
  matches: number;
  swipes: number;
  rightSwiper: { name: string; percent: number } | null;
} {
  const liked = [...input.matchThemes, ...input.swipes.filter((s) => s.verdict === "like" || s.verdict === "super").map((s) => s.theme)].filter(
    (t): t is string => t !== null && t in THEME_LABEL,
  );
  const counts = new Map<string, number>();
  for (const t of liked) counts.set(t, (counts.get(t) ?? 0) + 1);
  const themes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([key]) => THEME_LABEL[key]);
  const rates = input.people
    .map((p) => {
      const mine = input.swipes.filter((s) => s.userId === p.id && s.verdict !== "maybe");
      const right = mine.filter((s) => s.verdict === "like" || s.verdict === "super").length;
      return { name: p.name, total: mine.length, percent: mine.length ? Math.round((right / mine.length) * 100) : 0 };
    })
    .filter((r) => r.total >= 10);
  const rightSwiper =
    rates.length === 2 && rates[0].percent !== rates[1].percent ? [...rates].sort((a, b) => b.percent - a.percent)[0] : null;
  return { themes, matches: input.matchThemes.length, swipes: input.swipes.length, rightSwiper: rightSwiper && { name: rightSwiper.name, percent: rightSwiper.percent } };
}

/** The story link shows up on the dates page from this many dates on. */
export const STORY_MIN_DATES = 3;

/** The story is "ready" from 27 December; until the end of January the home screen points to last year's. */
export function storyYearToShow(now: Date, zone = APP_TIMEZONE): number | null {
  const t = DateTime.fromJSDate(now, { zone });
  if (t.month === 12 && t.day >= 27) return t.year;
  if (t.month === 1) return t.year - 1;
  return null;
}
