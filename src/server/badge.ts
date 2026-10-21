// The number on the app icon (core/next-step.ts `waitingForMe`): set by the app while it is open
// (components/app-badge.tsx) and by every push (sw.js), so it is right even while the app is closed.
import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { waitingForMe } from "@/core/next-step";
import type { CoupleContext } from "@/server/auth/dal";
import { calendarStates } from "@/server/availability";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { unansweredDate, upcomingDate } from "@/server/dates";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { dateToReview } from "@/server/reviews";
import { getCoupleSettings } from "@/server/settings";

export async function badgeFor(ctx: CoupleContext): Promise<number> {
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  if (!cycle) return 0;
  const [calendars, upcoming, toReview, unanswered] = await Promise.all([calendarStates(ctx), upcomingDate(ctx.coupleId, now), dateToReview(ctx, now), unansweredDate(ctx.coupleId, now)]);
  return waitingForMe({
    meId: ctx.user.id,
    myCalendar: calendars.find((p) => p.isMe)?.state ?? "missing",
    partnerCalendar: calendars.find((p) => !p.isMe)?.state ?? "missing",
    cycle,
    upcoming: upcoming ?? null,
    toReview: toReview ? { id: toReview.id, title: toReview.title } : null,
    unanswered: unanswered ? { id: unanswered.id, title: unanswered.title } : null,
  });
}

/** For a push to `userId` (no session there). null: not in a couple yet – the push leaves the icon alone. */
export async function badgeForUser(userId: string): Promise<number | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.coupleId) return null;
  const [partner] = await db
    .select()
    .from(users)
    .where(and(eq(users.coupleId, user.coupleId), ne(users.id, user.id)))
    .limit(1);
  if (!partner) return null;
  return badgeFor({ user, partner, coupleId: user.coupleId });
}
