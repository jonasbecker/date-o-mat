// The swipe deck's notifications and housekeeping: a match, a super like, the daily nudge, and the
// combo cards whose event has started.
import "server-only";
import { openCardsFor } from "@/server/deck-open";
import { and, eq, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { outOfQuietHours } from "@/core/reminders";
import { NUDGE_MIN_LIKES } from "@/core/deck";
import { APP_TIMEZONE } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { deckCards, notificationLog, users } from "@/server/db/schema";
import { sendToUser } from "@/server/push";
import { getCoupleSettings } from "@/server/settings";

// --- Notifications ------------------------------------------------------------------------------------

export async function notifyMatch(ctx: CoupleContext, match: { ideaId: string; title: string }): Promise<void> {
  const url = `/plan?idea=${match.ideaId}`;
  try {
    // The one who swiped just saw "keimt!" – only the other one hears about it.
    await sendToUser(ctx.partner.id, { title: "Match! 💞", body: `Ihr wollt beide: ${match.title}. Gleich planen?`, url, tag: "match" }, "match");
  } catch (error) {
    console.warn("[deck] match push failed", error instanceof Error ? error.message : error);
  }
}

export async function notifySuperLike(ctx: CoupleContext, title: string): Promise<void> {
  try {
    await sendToUser(
      ctx.partner.id,
      { title: `⭐ ${ctx.user.name} findet etwas super`, body: `„${title}“ – wischst du auch nach rechts?`, url: "/plan", tag: "deck" },
      "deck_nudge",
    );
  } catch (error) {
    console.warn("[deck] super-like push failed", error instanceof Error ? error.message : error);
  }
}

/** Once a day: "Sam hat 4 Ideen geliked – schau mal rein 👀" for liked cards you have not seen. */
export async function sendDeckNudges(coupleId: string, now: Date): Promise<void> {
  const members = await db.select().from(users).where(eq(users.coupleId, coupleId));
  if (members.length !== 2) return;
  const settings = await getCoupleSettings(coupleId);
  const rules = { quietHoursStartMinute: settings.quietHoursStartMinute, quietHoursEndMinute: settings.quietHoursEndMinute };
  if (outOfQuietHours(now, rules).getTime() !== now.getTime()) return;
  const day = DateTime.fromJSDate(now, { zone: APP_TIMEZONE });
  if (day.hour < 10) return; // not first thing in the morning
  for (const [me, partner] of [members, [...members].reverse()]) {
    const ctx: CoupleContext = { user: me, partner, coupleId };
    const { cards, partner: verdicts } = await openCardsFor(ctx, now);
    const waiting = cards.filter((c) => verdicts.get(c.id) === "like" || verdicts.get(c.id) === "super").length;
    if (waiting < NUDGE_MIN_LIKES) continue;
    const [claimed] = await db
      .insert(notificationLog)
      .values({ userId: me.id, type: "deck_nudge", refId: `likes:${day.toISODate()}`, dueAt: day.startOf("day").toJSDate() })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (!claimed) continue;
    await sendToUser(
      me.id,
      { title: `${partner.name} hat ${waiting} Ideen geliked 👀`, body: "Wisch mal durch – vielleicht habt ihr ein Match.", url: "/plan", tag: "deck" },
      "deck_nudge",
    );
  }
}

/** Combo cards whose event has started leave the deck. */
export async function expireDeckCards(coupleId: string, now: Date): Promise<void> {
  await db
    .update(deckCards)
    .set({ status: "expired" })
    .where(
      and(
        eq(deckCards.coupleId, coupleId),
        eq(deckCards.status, "open"),
        eq(deckCards.kind, "combo"),
        // A day of grace: all-day events start at midnight.
        lt(deckCards.eventStartsAt, new Date(now.getTime() - 86_400_000)),
      ),
    );
}

