// Past dates and their reviews ("Wie war's?").
import "server-only";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { REVIEW_PROMPT_DAYS, type ReviewInput } from "@/core/reviews";
import type { ReviewDate } from "@/core/reminders";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { datePlans, dateReviews, type DatePlan, type DateReview } from "@/server/db/schema";

export type PastDate = DatePlan & { reviews: DateReview[] };

async function withReviews(dates: DatePlan[]): Promise<PastDate[]> {
  if (dates.length === 0) return [];
  const reviews = await db
    .select()
    .from(dateReviews)
    .where(inArray(dateReviews.dateId, dates.map((d) => d.id)));
  return dates.map((date) => ({ ...date, reviews: reviews.filter((r) => r.dateId === date.id) }));
}

/** All dates that happened, newest first. */
export async function pastDates(coupleId: string): Promise<PastDate[]> {
  const dates = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done")))
    .orderBy(desc(datePlans.startsAt));
  return withReviews(dates);
}

export async function pastDate(coupleId: string, dateId: string): Promise<PastDate | undefined> {
  const [date] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.id, dateId), eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done")))
    .limit(1);
  return date ? (await withReviews([date]))[0] : undefined;
}

/** Writes (or overwrites) the viewer's own review. Only for dates that happened. */
export async function saveReview(ctx: CoupleContext, dateId: string, input: ReviewInput): Promise<boolean> {
  const date = await pastDate(ctx.coupleId, dateId);
  if (!date) return false;
  await db
    .insert(dateReviews)
    .values({ dateId, userId: ctx.user.id, rating: input.rating, note: input.note, again: input.again })
    .onConflictDoUpdate({
      target: [dateReviews.dateId, dateReviews.userId],
      set: { rating: input.rating, note: input.note, again: input.again },
    });
  return true;
}

/** The most recent date the viewer has not reviewed yet – shown on the home screen for a while. */
export async function dateToReview(ctx: CoupleContext, now: Date): Promise<DatePlan | undefined> {
  const since = new Date(now.getTime() - REVIEW_PROMPT_DAYS * 86_400_000);
  const recent = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, ctx.coupleId), eq(datePlans.status, "done"), gt(datePlans.endsAt, since)))
    .orderBy(desc(datePlans.startsAt));
  for (const date of await withReviews(recent)) {
    if (!date.reviews.some((r) => r.userId === ctx.user.id)) return date;
  }
  return undefined;
}

/** Recent dates for the "Wie war's?" reminder (it is due the day after). */
export async function reviewReminderDates(coupleId: string, now: Date): Promise<Array<ReviewDate & { title: string }>> {
  const since = new Date(now.getTime() - 3 * 86_400_000);
  const recent = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done"), gt(datePlans.endsAt, since)));
  return (await withReviews(recent)).map((date) => ({
    id: date.id,
    title: date.title,
    startsAt: date.startsAt,
    endsAt: date.endsAt,
    reviewedBy: date.reviews.map((r) => r.userId),
  }));
}
