// "Eure Date-Story": collects a year of dates, hearts, photos and swipes.
import "server-only";
import { extraOn, getCoupleSettings } from "@/server/settings";
import { and, asc, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import { dateCost } from "@/core/budget";
import { visibleRatings } from "@/core/reviews";
import { buildStory, storyYearToShow, swipeTaste, type Slide, type StorySwipe } from "@/core/story";
import { APP_TIMEZONE } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { budgetState } from "@/server/budget";
import { db } from "@/server/db";
import { budgetMonths, datePhotos, deckCards, deckSwipes, notificationLog, users } from "@/server/db/schema";
import { pastDates } from "@/server/reviews";
import { sendToUser } from "@/server/push";

function yearRange(year: number): { start: Date; end: Date } {
  const start = DateTime.fromObject({ year, month: 1, day: 1 }, { zone: APP_TIMEZONE });
  return { start: start.toJSDate(), end: start.plus({ years: 1 }).toJSDate() };
}

async function swipesBetween(coupleId: string, start: Date, end: Date): Promise<StorySwipe[]> {
  return db
    .select({ userId: deckSwipes.userId, verdict: deckSwipes.verdict, theme: deckCards.theme })
    .from(deckSwipes)
    .innerJoin(deckCards, eq(deckCards.id, deckSwipes.cardId))
    .where(and(eq(deckCards.coupleId, coupleId), ne(deckCards.kind, "revisit"), gte(deckSwipes.createdAt, start), lt(deckSwipes.createdAt, end)));
}

async function matchThemesBetween(coupleId: string, start: Date, end: Date): Promise<Array<string | null>> {
  const rows = await db
    .select({ theme: deckCards.theme })
    .from(deckCards)
    .where(and(eq(deckCards.coupleId, coupleId), eq(deckCards.status, "matched"), ne(deckCards.kind, "revisit"), gte(deckCards.matchedAt, start), lt(deckCards.matchedAt, end)));
  return rows.map((r) => r.theme);
}

export async function storyFor(ctx: CoupleContext, year: number, now: Date): Promise<Slide[]> {
  const { start, end } = yearRange(year);
  const dates = (await pastDates(ctx.coupleId)).filter((d) => d.startsAt >= start && d.startsAt < end).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const [photos, swipes, matchThemes, pot] = await Promise.all([
    dates.length
      ? db
          .select({ id: datePhotos.id, dateId: datePhotos.dateId })
          .from(datePhotos)
          .where(and(eq(datePhotos.coupleId, ctx.coupleId), inArray(datePhotos.dateId, dates.map((d) => d.id))))
          .orderBy(asc(datePhotos.createdAt))
      : Promise.resolve([]),
    swipesBetween(ctx.coupleId, start, end),
    matchThemesBetween(ctx.coupleId, start, end),
    potAtEndOf(ctx.coupleId, year, now),
  ]);
  return buildStory({
    year,
    dates: dates.map((d) => ({
      id: d.id,
      title: d.title,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      size: d.size,
      cost: d.actualCostEur === null && d.estimatedCostEur === null ? null : dateCost(d),
      ratings: visibleRatings(d.reviews, ctx.user.id),
      photoIds: photos.filter((p) => p.dateId === d.id).map((p) => p.id),
    })),
    swipes,
    matchThemes,
    people: [ctx.user, ctx.partner].map((p) => ({ id: p.id, name: p.name })),
    pot,
  });
}

async function potAtEndOf(coupleId: string, year: number, now: Date): Promise<number | null> {
  if (DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).year === year) return (await budgetState(coupleId, now))?.pot ?? null;
  const [row] = await db
    .select({ pot: budgetMonths.potAfterEur })
    .from(budgetMonths)
    .where(and(eq(budgetMonths.coupleId, coupleId), gte(budgetMonths.month, `${year}-01`), lt(budgetMonths.month, `${year + 1}-01`)))
    .orderBy(desc(budgetMonths.month))
    .limit(1);
  return row?.pot ?? null;
}

/** Years with something to tell, newest first. */
export async function storyYears(coupleId: string, now: Date): Promise<number[]> {
  const years = new Set<number>((await pastDates(coupleId)).map((d) => DateTime.fromJSDate(d.startsAt, { zone: APP_TIMEZONE }).year));
  const swipe = await db
    .select({ at: deckSwipes.createdAt })
    .from(deckSwipes)
    .innerJoin(deckCards, eq(deckCards.id, deckSwipes.cardId))
    .where(eq(deckCards.coupleId, coupleId))
    .limit(1);
  if (swipe[0]) years.add(DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).year);
  return [...years].sort((a, b) => b - a);
}

/** "Euer Ding" for the swipe page: all-time favourite themes. */
export async function deckTaste(ctx: CoupleContext): Promise<string[]> {
  const all = { start: new Date("2000-01-01T00:00:00Z"), end: new Date("2100-01-01T00:00:00Z") };
  const [swipes, matchThemes] = await Promise.all([swipesBetween(ctx.coupleId, all.start, all.end), matchThemesBetween(ctx.coupleId, all.start, all.end)]);
  if (swipes.length < 10) return [];
  return swipeTaste({ swipes, matchThemes, people: [ctx.user, ctx.partner] }).themes;
}

/** Tick: on 27 December (from 10:00) "Eure Date-Story 2026 ist fertig 📖" – once a year. */
export async function sendStoryReady(coupleId: string, now: Date): Promise<void> {
  const t = DateTime.fromJSDate(now, { zone: APP_TIMEZONE });
  if (storyYearToShow(now) !== t.year || t.hour < 10) return;
  if (!extraOn(await getCoupleSettings(coupleId), "story")) return;
  const { start, end } = yearRange(t.year);
  const dates = (await pastDates(coupleId)).filter((d) => d.startsAt >= start && d.startsAt < end);
  if (dates.length === 0) return;
  const members = await db.select({ id: users.id }).from(users).where(eq(users.coupleId, coupleId));
  for (const member of members) {
    const [claimed] = await db
      .insert(notificationLog)
      .values({ userId: member.id, type: "story", refId: String(t.year), dueAt: t.startOf("day").toJSDate() })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (!claimed) continue;
    await sendToUser(
      member.id,
      { title: `Eure Date-Story ${t.year} ist fertig 📖`, body: `${dates.length} Dates, eure Lieblingsmomente und mehr – tipp rein.`, url: `/story?year=${t.year}`, tag: "story" },
      "story",
    ).catch(() => 0);
  }
}
