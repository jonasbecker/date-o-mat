// Which cards of the deck one person can still swipe (shared by the deck, its refill and its nudges).
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { orderDeck } from "@/core/deck";
import { APP_TIMEZONE, type SwipeVerdict } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { deckCards, deckSwipes, type DeckCard } from "@/server/db/schema";


/** Combo cards stay until their event starts (all-day events: until the end of that day). */
export function stillValid(card: Pick<DeckCard, "eventStartsAt" | "eventAllDay">, now: Date): boolean {
  if (!card.eventStartsAt) return true;
  const until = card.eventAllDay ? DateTime.fromJSDate(card.eventStartsAt, { zone: APP_TIMEZONE }).endOf("day").toJSDate() : card.eventStartsAt;
  return until > now;
}

/** Open cards one person has not swiped yet, in their order. */
export async function openCardsFor(ctx: CoupleContext, now: Date): Promise<{ cards: DeckCard[]; partner: Map<string, SwipeVerdict> }> {
  const rows = await db
    .select({ card: deckCards, mine: deckSwipes.verdict, revisitAt: deckSwipes.revisitAt })
    .from(deckCards)
    .leftJoin(deckSwipes, and(eq(deckSwipes.cardId, deckCards.id), eq(deckSwipes.userId, ctx.user.id)))
    .where(and(eq(deckCards.coupleId, ctx.coupleId), eq(deckCards.status, "open")));
  // Not swiped yet – or put on "Vielleicht" and due again.
  const cards = rows
    .filter((r) => (r.mine === null || (r.mine === "maybe" && r.revisitAt !== null && r.revisitAt <= now)) && stillValid(r.card, now))
    .map((r) => r.card);
  const partnerRows = cards.length
    ? await db
        .select({ cardId: deckSwipes.cardId, verdict: deckSwipes.verdict })
        .from(deckSwipes)
        .where(and(eq(deckSwipes.userId, ctx.partner.id), inArray(deckSwipes.cardId, cards.map((c) => c.id))))
    : [];
  const partner = new Map(partnerRows.map((r) => [r.cardId, r.verdict]));
  return { cards: orderDeck(cards, partner), partner };
}
