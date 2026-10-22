// The swipe deck ("Entdecken"): stores Claude's cards, the swipes of both,
// matches (→ wishlist) and refills the deck in the background.
import "server-only";
import { and, desc, eq, gt, inArray, isNull, lt, max, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  cardCategory,
  maybeRevisitAt,
  REVISIT_AFTER_DAYS,
  revisitOutcome,
  superLikeLeft,
  swipeOutcome,
  type DeckCardView,
  type SwipeOutcome,
} from "@/core/deck";
import { APP_TIMEZONE, type IdeaSize, type SwipeVerdict } from "@/lib/domain";
import { cardArt } from "@/core/card-art";
import { eventWhen as eventWhenOnCard, firstFree, freeWhen } from "@/core/card-when";
import { CATEGORY_LABEL } from "@/core/categories";
import { eventSpan, fitsFreeTime } from "@/core/events";
import { mergeRanges } from "@/core/ranges";
import { findSlots, type Slot } from "@/core/slots";
import { queryFreeBusy } from "@/server/google/calendar-api";
import { cachedBusy } from "@/server/busy-cache";
import { getConnection } from "@/server/google/connection";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { datePlans, deckCards, deckSwipes, ideas, suggestions, type DeckCard } from "@/server/db/schema";
import { env } from "@/server/env";
import { getCoupleSettings, slotRulesFrom } from "@/server/settings";

import { openCardsFor, stillValid } from "@/server/deck-open";
import { STALE_REFILL_MS } from "@/server/deck-refill";

// The pieces that moved out stay importable from here, so callers keep one door.
export { DECK_MODEL, refillDeck, type RefillResult } from "@/server/deck-refill";
export { expireDeckCards, notifyMatch, notifySuperLike, sendDeckNudges } from "@/server/deck-notify";

// --- Reading -------------------------------------------------------------------------------------

/** Combo cards stay until their event starts (all-day events: until the end of that day). */
function eventWhen(startsAt: Date, allDay: boolean): string {
  const t = DateTime.fromJSDate(startsAt, { zone: APP_TIMEZONE }).setLocale("de");
  return allDay ? t.toFormat("cccc, d. LLLL") : t.toFormat("cccc, d. LLLL, HH:mm 'Uhr'");
}

export function cardView(card: DeckCard, partnerVerdict: SwipeVerdict | undefined): DeckCardView {
  const category = cardCategory(card);
  return {
    id: card.id,
    kind: card.kind,
    title: card.title,
    note: card.note,
    emoji: card.emoji,
    size: card.size,
    costEur: card.costEur,
    location: card.location,
    setting: card.setting,
    theme: card.theme,
    wildcard: card.wildcard,
    event:
      card.kind === "combo" && card.eventStartsAt
        ? {
            title: card.eventTitle ?? "",
            startsAt: card.eventStartsAt.toISOString(),
            endsAt: card.eventEndsAt?.toISOString() ?? null,
            allDay: card.eventAllDay,
            venue: card.eventVenue,
            url: card.eventUrl,
            when: eventWhen(card.eventStartsAt, card.eventAllDay),
          }
        : null,
    partnerSuper: partnerVerdict === "super",
    art: cardArt({ ...card, category }),
    sorte: card.wildcard ? "Mal was anderes" : CATEGORY_LABEL[category].label,
  };
}

export type DeckState = {
  cards: DeckCardView[];
  /** Put on "Vielleicht", coming back later. */
  maybes: number;
  superLeft: boolean;
  /** A batch is being made right now. */
  generating: boolean;
  matches: number;
  ai: boolean;
  /** How many cards the partner has swiped so far ("S. hat 12 geswipt"). */
  partnerSwiped: number;
};

export async function deckFor(ctx: CoupleContext, now: Date): Promise<DeckState> {
  const [{ cards, partner }, lastSuper, settings, matches, maybes, partnerSwiped] = await Promise.all([
    openCardsFor(ctx, now),
    lastSuperLike(ctx.user.id),
    getCoupleSettings(ctx.coupleId),
    // Only matches still on the wishlist – the same number as the Matchlinge tile on /ideas.
    db.$count(
      deckCards,
      and(
        eq(deckCards.coupleId, ctx.coupleId),
        eq(deckCards.status, "matched"),
        ne(deckCards.kind, "revisit"),
        inArray(deckCards.ideaId, db.select({ id: ideas.id }).from(ideas).where(and(eq(ideas.coupleId, ctx.coupleId), isNull(ideas.archivedAt)))),
      ),
    ),
    maybeCount(ctx, now),
    db.$count(deckSwipes, eq(deckSwipes.userId, ctx.partner.id)),
  ]);
  const since = await waitingSinceLabels(cards, now);
  const views = cards.map((card) => ({ ...cardView(card, partner.get(card.id)), waitingSince: since.get(card.id) ?? null }));
  // The day on every card: the event (and whether both are free then) or the next free evening.
  const times = await deckTimes(ctx, now, cards);
  for (const view of views) {
    const card = cards.find((c) => c.id === view.id)!;
    if (card.kind === "combo" && card.eventStartsAt) {
      view.bothFree = times.calendars ? (times.eventFree.get(card.id) ?? null) : null;
      view.when = eventWhenOnCard({ startsAt: card.eventStartsAt, allDay: card.eventAllDay }, view.bothFree);
    } else {
      view.when = freeWhen(times.free[card.size], times.calendars);
    }
  }
  const refillAt = settings.deckRefillStartedAt;
  return {
    cards: views,
    maybes,
    superLeft: superLikeLeft(lastSuper, new Date()),
    generating: Boolean(refillAt && Date.now() - refillAt.getTime() < STALE_REFILL_MS),
    matches,
    ai: env().ai,
    partnerSwiped,
  };
}

async function lastSuperLike(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(deckSwipes.createdAt) })
    .from(deckSwipes)
    .where(and(eq(deckSwipes.userId, userId), eq(deckSwipes.verdict, "super")));
  return row?.at ?? null;
}

/** Number of cards this person can still swipe (for the home tile). */
export async function remainingCards(ctx: CoupleContext, now: Date): Promise<number> {
  return (await openCardsFor(ctx, now)).cards.length;
}

// --- Swiping -------------------------------------------------------------------------------------

/** How far ahead the card looks for a free evening. */
const FREE_LOOKAHEAD_DAYS = 14;

/**
 * One FreeBusy query per person for the whole deck: is each combo's event free for both, and the next
 * free evening (small) and half day (large) for every other card. Calendars missing or failing → unknown.
 */
async function deckTimes(ctx: CoupleContext, now: Date, cards: DeckCard[]): Promise<{ calendars: boolean; eventFree: Map<string, boolean>; free: Record<IdeaSize, Slot | null> }> {
  const none = { calendars: false, eventFree: new Map<string, boolean>(), free: { small: null, large: null } };
  if (cards.length === 0) return none;
  const settings = await getCoupleSettings(ctx.coupleId);
  const spans = cards.flatMap((c) => {
    const span = c.kind === "combo" ? eventSpan({ startsAt: c.eventStartsAt, endsAt: c.eventEndsAt, allDay: c.eventAllDay }) : null;
    return span ? [{ id: c.id, span }] : [];
  });
  const buffer = settings.bufferMinutes * 60_000;
  const until = new Date(Math.max(now.getTime() + FREE_LOOKAHEAD_DAYS * 86_400_000, ...spans.map((s) => s.span.end.getTime() + buffer)));
  try {
    // A few minutes old is fine for "the next free evening" (busy-cache.ts); a new date clears it.
    const raw = await cachedBusy(ctx.coupleId, now, until, async () => {
      const results = await Promise.all(
        [ctx.user, ctx.partner].map(async (person) => {
          const connection = await getConnection(person.id);
          if (!connection || connection.status !== "ok") throw new CalendarMissing();
          return queryFreeBusy(person.id, connection.busyCalendarIds ?? ["primary"], now, until);
        }),
      );
      return results.flatMap((r) => r.busy);
    });
    const busy = mergeRanges(raw);
    const rules = slotRulesFrom(settings);
    const free = (size: IdeaSize) => firstFree(findSlots({ now, until: new Date(now.getTime() + FREE_LOOKAHEAD_DAYS * 86_400_000), busy: raw, rules, size, limit: FREE_LOOKAHEAD_DAYS }), size);
    return {
      calendars: true,
      eventFree: new Map(spans.map(({ id, span }) => [id, fitsFreeTime(span, busy, settings.bufferMinutes)])),
      free: { small: free("small"), large: free("large") },
    };
  } catch (error) {
    if (!(error instanceof CalendarMissing)) console.warn("[deck] free-time check failed", error instanceof Error ? error.message : error);
    return none;
  }
}

class CalendarMissing extends Error {}

export type SwipeResult =
  | {
      ok: true;
      outcome: SwipeOutcome;
      title: string;
      match: { ideaId: string; title: string } | null;
      /** The like put the card on the wishlist (or it was there already). */
      saved: boolean;
    }
  | { ok: false; error: "gone" | "super_used" };

function matchNote(card: DeckCard): string | null {
  const parts = [card.note];
  if (card.kind === "combo" && card.eventStartsAt) {
    const when = DateTime.fromJSDate(card.eventStartsAt, { zone: APP_TIMEZONE }).setLocale("de");
    parts.push(`🎟️ ${card.eventTitle ?? "Event"} · ${card.eventAllDay ? when.toFormat("ccc d. LLL") : when.toFormat("ccc d. LLL, HH:mm")} Uhr${card.eventVenue ? ` · ${card.eventVenue}` : ""}`);
  }
  const note = parts.filter(Boolean).join("\n");
  return note ? note.slice(0, 1000) : null;
}

export async function swipe(ctx: CoupleContext, cardId: string, verdict: SwipeVerdict, now: Date): Promise<SwipeResult> {
  if (verdict === "super" && !superLikeLeft(await lastSuperLike(ctx.user.id), new Date())) return { ok: false, error: "super_used" };
  return db.transaction(async (tx) => {
    const [card] = await tx
      .select()
      .from(deckCards)
      .where(and(eq(deckCards.id, cardId), eq(deckCards.coupleId, ctx.coupleId)))
      .for("update");
    if (!card || card.status !== "open") return { ok: false, error: "gone" } as const;
    const revisitAt = verdict === "maybe" ? maybeRevisitAt(card.bestSeason, now) : null;
    // A "maybe" can be decided again later; any other swipe is final (until undone).
    const inserted = await tx
      .insert(deckSwipes)
      .values({ cardId, userId: ctx.user.id, verdict, revisitAt })
      .onConflictDoUpdate({
        target: [deckSwipes.cardId, deckSwipes.userId],
        set: { verdict, revisitAt, createdAt: new Date() },
        setWhere: eq(deckSwipes.verdict, "maybe"),
      })
      .returning();
    if (inserted.length === 0) return { ok: false, error: "gone" } as const;
    const [partner] = await tx
      .select({ verdict: deckSwipes.verdict })
      .from(deckSwipes)
      .where(and(eq(deckSwipes.cardId, cardId), eq(deckSwipes.userId, ctx.partner.id)));
    if (card.kind === "revisit") {
      const outcome = revisitOutcome(verdict, partner?.verdict ?? null);
      if (outcome === "keep") await tx.update(deckCards).set({ status: "matched", matchedAt: new Date() }).where(eq(deckCards.id, cardId));
      if (outcome === "archive" && card.ideaId) {
        await tx.update(deckCards).set({ status: "passed" }).where(eq(deckCards.id, cardId));
        await tx.update(ideas).set({ archivedAt: new Date(), updatedById: ctx.user.id }).where(and(eq(ideas.id, card.ideaId), eq(ideas.coupleId, ctx.coupleId)));
      }
      return { ok: true, outcome, title: card.title, match: null, saved: false } as const;
    }
    const outcome = swipeOutcome(verdict, partner?.verdict ?? null);
    if (outcome === "pass") {
      await tx.update(deckCards).set({ status: "passed" }).where(eq(deckCards.id, cardId));
      return { ok: true, outcome, title: card.title, match: null, saved: false } as const;
    }
    if (outcome === "wait" && verdict === "maybe") return { ok: true, outcome, title: card.title, match: null, saved: false } as const;
    // A like goes onto the wishlist right away (the first like adds it); the card stays in
    // the partner's deck, and their like makes it a match.
    let ideaId = card.ideaId;
    if (!ideaId) {
      const [idea] = await tx
        .insert(ideas)
        .values({
          coupleId: ctx.coupleId,
          title: card.title.slice(0, 120),
          size: card.size,
          note: matchNote(card),
          url: card.eventUrl,
          costEur: card.costEur,
          location: card.location ?? card.eventVenue,
          setting: card.setting,
          category: cardCategory({ theme: card.theme, title: card.title, note: card.note, kind: card.kind }),
          color: card.color,
          illustrations: card.illustrations,
          quips: card.quips,
          source: "deck",
          externalRef: card.id,
          createdById: ctx.user.id,
          updatedById: ctx.user.id,
        })
        .returning({ id: ideas.id });
      ideaId = idea.id;
    }
    if (outcome === "match") {
      await tx.update(deckCards).set({ status: "matched", matchedAt: new Date(), ideaId }).where(eq(deckCards.id, cardId));
      // Taken off the list in the meantime? Now both want it – back it comes.
      if (card.ideaId) await tx.update(ideas).set({ archivedAt: null }).where(and(eq(ideas.id, ideaId), eq(ideas.coupleId, ctx.coupleId)));
      return { ok: true, outcome, title: card.title, match: { ideaId, title: card.title }, saved: true } as const;
    }
    await tx.update(deckCards).set({ ideaId }).where(eq(deckCards.id, cardId));
    return { ok: true, outcome, title: card.title, match: null, saved: true } as const;
  });
}

/** `kept`: only the like was taken back – the idea stays on the list (planned, suggested or edited by the other one). */
export type UndoResult = { ok: true; card: DeckCardView; kept?: boolean } | { ok: false; error: "nothing" };

/** Takes back this person's latest swipe – again and again, one at a time. */
export async function undoLastSwipe(ctx: CoupleContext, now: Date): Promise<UndoResult> {
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ swipe: deckSwipes, card: deckCards })
      .from(deckSwipes)
      .innerJoin(deckCards, eq(deckCards.id, deckSwipes.cardId))
      .where(and(eq(deckSwipes.userId, ctx.user.id), eq(deckCards.coupleId, ctx.coupleId), ne(deckCards.status, "expired")))
      .orderBy(desc(deckSwipes.createdAt))
      .limit(1);
    if (!last || !stillValid(last.card, now)) return { ok: false, error: "nothing" } as const;
    const card = last.card;
    if (card.kind === "revisit") {
      // Kept or removed from the wishlist: back to how it was.
      if (card.status === "passed" && card.ideaId) await tx.update(ideas).set({ archivedAt: null }).where(and(eq(ideas.id, card.ideaId), eq(ideas.coupleId, ctx.coupleId)));
    }
    const [partner] = await tx
      .select({ verdict: deckSwipes.verdict })
      .from(deckSwipes)
      .where(and(eq(deckSwipes.cardId, card.id), eq(deckSwipes.userId, ctx.partner.id)));
    const partnerLikes = partner?.verdict === "like" || partner?.verdict === "super";
    let ideaId = card.ideaId;
    let kept = false;
    // Taking back the only like takes the idea off the wishlist again – unless it already lives on:
    // planned, in a round's suggestion, or changed by the other one. Then only the like goes.
    if (card.kind !== "revisit" && card.ideaId && !partnerLikes && (last.swipe.verdict === "like" || last.swipe.verdict === "super")) {
      const [planned, suggested, [idea]] = await Promise.all([
        tx.$count(datePlans, eq(datePlans.ideaId, card.ideaId)),
        tx.$count(suggestions, and(eq(suggestions.ideaId, card.ideaId), eq(suggestions.status, "pending"))),
        tx.select({ updatedById: ideas.updatedById }).from(ideas).where(eq(ideas.id, card.ideaId)).limit(1),
      ]);
      kept = planned > 0 || suggested > 0 || idea?.updatedById === ctx.partner.id;
      if (!kept) {
        await tx.delete(ideas).where(and(eq(ideas.id, card.ideaId), eq(ideas.coupleId, ctx.coupleId)));
        ideaId = null;
      }
    }
    await tx.update(deckCards).set({ status: "open", matchedAt: null, ideaId }).where(eq(deckCards.id, card.id));
    await tx.delete(deckSwipes).where(and(eq(deckSwipes.cardId, card.id), eq(deckSwipes.userId, ctx.user.id)));
    return { ok: true, card: cardView({ ...card, status: "open" }, partner?.verdict), kept } as const;
  });
}

// --- Old wishlist ideas and "Vielleicht" ------------------------------------------------------------

/**
 * Tick: at most one idea a day that has waited long on the wishlist (never
 * planned, not asked about recently) comes back as a "noch Lust?" card.
 */
export async function resurfaceOldIdea(coupleId: string, now: Date): Promise<void> {
  const day = 86_400_000;
  const recent = await db.$count(deckCards, and(eq(deckCards.coupleId, coupleId), eq(deckCards.kind, "revisit"), gt(deckCards.createdAt, new Date(Date.now() - 20 * 3_600_000))));
  if (recent > 0) return;
  const cutoff = new Date(now.getTime() - REVISIT_AFTER_DAYS * day);
  const candidates = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt), lt(ideas.createdAt, cutoff), lt(ideas.updatedAt, cutoff)))
    .orderBy(ideas.createdAt)
    .limit(20);
  for (const idea of candidates) {
    const [planned, asked] = await Promise.all([
      db.$count(datePlans, eq(datePlans.ideaId, idea.id)),
      db.$count(deckCards, and(eq(deckCards.coupleId, coupleId), eq(deckCards.kind, "revisit"), eq(deckCards.ideaId, idea.id), gt(deckCards.createdAt, cutoff))),
    ]);
    if (planned > 0 || asked > 0) continue;
    await db
      .insert(deckCards)
      .values({
        coupleId,
        kind: "revisit",
        title: idea.title,
        note: idea.note,
        size: idea.size,
        costEur: idea.costEur,
        location: idea.location,
        setting: idea.setting,
        color: idea.color,
        illustrations: idea.illustrations,
        quips: idea.quips,
        emoji: "🕰️",
        dedupeKey: `revisit:${idea.id}:${DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).toISODate()}`,
        ideaId: idea.id,
        batch: 0,
      })
      .onConflictDoNothing();
    return;
  }
}

/** "seit März" / "seit März 2025" for revisit cards. */
export async function waitingSinceLabels(cards: DeckCard[], now: Date): Promise<Map<string, string>> {
  const ids = cards.filter((c) => c.kind === "revisit" && c.ideaId).map((c) => c.ideaId!);
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: ideas.id, createdAt: ideas.createdAt }).from(ideas).where(inArray(ideas.id, ids));
  const year = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).year;
  const labels = new Map<string, string>();
  for (const card of cards) {
    const created = rows.find((r) => r.id === card.ideaId)?.createdAt;
    if (!created) continue;
    const t = DateTime.fromJSDate(created, { zone: APP_TIMEZONE }).setLocale("de");
    labels.set(card.id, `seit ${t.toFormat(t.year === year ? "LLLL" : "LLLL yyyy")}`);
  }
  return labels;
}

/** Cards this person put on "Vielleicht" that are not due yet. */
export async function maybeCount(ctx: CoupleContext, now: Date): Promise<number> {
  return db
    .select({ cardId: deckSwipes.cardId })
    .from(deckSwipes)
    .innerJoin(deckCards, eq(deckCards.id, deckSwipes.cardId))
    .where(and(eq(deckSwipes.userId, ctx.user.id), eq(deckSwipes.verdict, "maybe"), gt(deckSwipes.revisitAt, now), eq(deckCards.status, "open")))
    .then((rows) => rows.length);
}

/** "Jetzt nochmal ansehen": all of this person's "Vielleicht" cards come back now. */
export async function bringBackMaybes(ctx: CoupleContext, now: Date): Promise<void> {
  await db
    .update(deckSwipes)
    .set({ revisitAt: now })
    .where(and(eq(deckSwipes.userId, ctx.user.id), eq(deckSwipes.verdict, "maybe"), gt(deckSwipes.revisitAt, now)));
}
