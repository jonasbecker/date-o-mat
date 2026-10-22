"use client";

// Swiping without network: the swipe is kept on the phone (localStorage) and sent as soon as there is
// network again – from any page (`SwipeQueueFlusher` in the (app) layout), oldest first. A card in the queue
// stays off the deck meanwhile. Signed out, the queue goes with the kept pages (forget-pages.tsx).
import { WISHLIST_ADDED_EVENT } from "@/components/wishlist-badge";
import type { SwipeResult } from "@/server/deck";
import { swipeAction } from "./actions";

export type QueuedSwipe = { cardId: string; verdict: "like" | "nope"; at: number };

const KEY = "dom-swipe-queue";
/** Older than this, a kept swipe is dropped (the card is long gone or the deck was renewed). */
const MAX_AGE_MS = 3 * 24 * 60 * 60_000;
const SEND_TIMEOUT_MS = 8_000;
/** Told after each send: `result` (null: still no network – it stays queued). */
export const SWIPE_SENT_EVENT = "dom-swipe-sent";
export type SwipeSent = { swipe: QueuedSwipe; result: SwipeResult };

export function queuedSwipes(now = Date.now()): QueuedSwipe[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedSwipe[];
    return Array.isArray(list) ? list.filter((s) => s && typeof s.cardId === "string" && now - s.at < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

function store(list: QueuedSwipe[]) {
  try {
    if (list.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage blocked: the swipe is lost, like before
  }
}

export function queueSwipe(swipe: Omit<QueuedSwipe, "at">) {
  store([...queuedSwipes().filter((s) => s.cardId !== swipe.cardId), { ...swipe, at: Date.now() }]);
}

/** Takes a kept swipe back (↺ while still offline). True if it was there. */
export function unqueueSwipe(cardId: string): boolean {
  const list = queuedSwipes();
  store(list.filter((s) => s.cardId !== cardId));
  return list.some((s) => s.cardId === cardId);
}

export function forgetSwipes() {
  store([]);
}

let sending: Promise<number> | null = null;
/** Counts the runs, so a run left behind does not clear a newer one. */
let runs = 0;

/**
 * Sends what was kept, one after the other; stops at the first that still has no network. Returns how many went.
 * Only one run at a time – except `fresh`: the network just came back, so a run that began while it was gone (and may
 * hang until its timeout) is left behind and a new one starts at once. Should the old one still get through, the card
 * is swiped already by then and the second send only clears the queue.
 */
export function sendQueuedSwipes({ fresh = false }: { fresh?: boolean } = {}): Promise<number> {
  if (sending && !fresh) return sending;
  const mine = ++runs;
  const run = (async () => {
    let sent = 0;
    try {
      for (const swipe of queuedSwipes()) {
        // A request that hangs while the network flips must not block the queue for good: after 8 s it counts as failed.
        const result = await Promise.race([swipeAction(swipe.cardId, swipe.verdict).catch(() => null), new Promise<null>((resolve) => setTimeout(() => resolve(null), SEND_TIMEOUT_MS))]);
        if (!result) break;
        // Done either way: counted, or the card was gone meanwhile (nothing to send any more).
        unqueueSwipe(swipe.cardId);
        sent++;
        if (result.ok && result.saved) window.dispatchEvent(new Event(WISHLIST_ADDED_EVENT));
        window.dispatchEvent(new CustomEvent<SwipeSent>(SWIPE_SENT_EVENT, { detail: { swipe, result } }));
      }
    } finally {
      if (runs === mine) sending = null;
    }
    return sent;
  })();
  sending = run;
  return run;
}
