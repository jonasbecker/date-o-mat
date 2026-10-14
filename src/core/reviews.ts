// Review after a date ("Wie war's?"): when to ask, what each person may see,
// and the numbers for the "Unsere Dates" page. Pure – no DB.

import { DateTime } from "luxon";
import { APP_TIMEZONE, RATING_MAX, RATING_MIN, REVIEW_NOTE_MAX } from "@/lib/domain";

export type ReviewInput = { rating: number; note: string | null };

export type ReviewView = { userId: string; rating: number; note: string | null };

/** How long the home screen keeps asking "Wie war's?" after a date. */
export const REVIEW_PROMPT_DAYS = 14;

const ASK_HOUR = 11; // the day after, late morning

/**
 * When to ask "Wie war's?": the day after the date started, 11:00 – but never
 * earlier than an hour after it ended (a date that runs past midnight).
 */
export function reviewAskAt(date: { startsAt: Date; endsAt: Date }, zone = APP_TIMEZONE): Date {
  const nextDay = DateTime.fromJSDate(date.startsAt, { zone })
    .plus({ days: 1 })
    .set({ hour: ASK_HOUR, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
  const afterEnd = new Date(date.endsAt.getTime() + 3_600_000);
  return nextDay > afterEnd ? nextDay : afterEnd;
}

export function parseReview(raw: { rating: unknown; note: unknown }): ReviewInput | null {
  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) return null;
  const note = typeof raw.note === "string" ? raw.note.trim().slice(0, REVIEW_NOTE_MAX) : "";
  return { rating, note: note || null };
}

/**
 * The partner's review stays hidden until you have written your own – so
 * nobody adjusts their hearts to the other one's.
 */
export function visibleReviews(reviews: ReviewView[], viewerId: string): { mine: ReviewView | null; partner: ReviewView | null; partnerHidden: boolean } {
  const mine = reviews.find((r) => r.userId === viewerId) ?? null;
  const theirs = reviews.find((r) => r.userId !== viewerId) ?? null;
  return { mine, partner: mine ? theirs : null, partnerHidden: !mine && theirs !== null };
}

export type StatsDate = { id: string; title: string; startsAt: Date; ratings: number[] };

export type ReviewStats = {
  count: number;
  /** Average hearts over all reviews, one decimal; null without reviews. */
  averageRating: number | null;
  /** Highest average; on a tie the more recent date. Needs at least one review. */
  favorite: { id: string; title: string; average: number } | null;
  /** Dates in the current calendar year. */
  thisYear: number;
};

export function reviewStats(dates: StatsDate[], now: Date, zone = APP_TIMEZONE): ReviewStats {
  const all = dates.flatMap((d) => d.ratings);
  const year = DateTime.fromJSDate(now, { zone }).year;
  let favorite: ReviewStats["favorite"] = null;
  let favoriteStart = 0;
  for (const date of dates) {
    if (date.ratings.length === 0) continue;
    const average = date.ratings.reduce((a, b) => a + b, 0) / date.ratings.length;
    const better = !favorite || average > favorite.average || (average === favorite.average && date.startsAt.getTime() > favoriteStart);
    if (better) {
      favorite = { id: date.id, title: date.title, average };
      favoriteStart = date.startsAt.getTime();
    }
  }
  return {
    count: dates.length,
    averageRating: all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null,
    favorite,
    thisYear: dates.filter((d) => DateTime.fromJSDate(d.startsAt, { zone }).year === year).length,
  };
}
