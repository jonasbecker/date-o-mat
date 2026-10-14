"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { DECK_FILTERS, type DeckFilter } from "@/core/deck";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { notifyMatch, notifySuperLike, refillDeck, swipe, undoLastSwipe, type SwipeResult, type UndoResult } from "@/server/deck";
import { getCoupleSettings } from "@/server/settings";

const SwipeInput = z.object({ cardId: z.uuid(), verdict: z.enum(["like", "super", "nope"]) });

// No refresh() here: the deck on the page keeps its own state, so a swipe never
// makes the cards jump. New cards arrive with the page's AutoRefresh.
export async function swipeAction(cardId: string, verdict: "like" | "super" | "nope"): Promise<SwipeResult> {
  const ctx = await requireCouple();
  const input = SwipeInput.safeParse({ cardId, verdict });
  if (!input.success) return { ok: false, error: "gone" };
  const result = await swipe(ctx, input.data.cardId, input.data.verdict);
  if (result.ok) {
    const match = result.match;
    if (match) after(() => notifyMatch(ctx, match));
    else if (input.data.verdict === "super") after(() => notifySuperLike(ctx, result.title));
    // Running low? The next batch is made in the background.
    after(async () => refillDeck(ctx.coupleId, coupleNow(await getCoupleSettings(ctx.coupleId))));
  }
  return result;
}

export async function undoSwipeAction(): Promise<UndoResult> {
  const ctx = await requireCouple();
  const result = await undoLastSwipe(ctx, coupleNow(await getCoupleSettings(ctx.coupleId)));
  if (result.ok) refresh(); // the wishlist may have lost a match
  return result;
}

const MESSAGES = {
  made: null,
  not_needed: null,
  busy: "Es werden gerade schon neue Ideen gemischt – gleich sind sie da.",
  limit: "Für heute ist Schluss mit neuen Karten – morgen gibt's frische.",
  off: "Die KI ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt).",
  failed: "Das hat gerade nicht geklappt – versuch's gleich nochmal.",
} as const;

/** "Neue Ideen holen" / "Mehr davon": a batch right away, matching the filter. */
export async function moreCardsAction(filter: DeckFilter): Promise<{ ok: boolean; message: string | null }> {
  const ctx = await requireCouple();
  const focus = (DECK_FILTERS as readonly string[]).includes(filter) ? filter : "all";
  const result = await refillDeck(ctx.coupleId, coupleNow(await getCoupleSettings(ctx.coupleId)), { manual: true, focus });
  refresh();
  return { ok: result === "made", message: MESSAGES[result] };
}
