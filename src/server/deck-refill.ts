// The swipe deck's refill: Claude (or the curated Köln ideas) makes a batch of cards in the background –
// claiming the refill, the prompt, the answer, the cards in the table.
import "server-only";
import { openCardsFor } from "@/server/deck-open";
import type { IdeaFilter } from "@/core/filters";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  buildDeckPrompt,
  cleanDeckCards,
  comboCount,
  CURATED_PER_BATCH,
  curatedForDeck,
  DECK_AUTO_BATCHES_PER_DAY,
  DECK_BATCH_SIZE,
  DECK_SYSTEM_PROMPT,
  dedupeKey,
  needsRefill,
  matchesFilter,
  pickThemes,
  type CardDraft,
} from "@/core/deck";
import { APP_TIMEZONE } from "@/lib/domain";
import { CARD_COLORS } from "@/core/card-art";
import { aiRequestsToday, anthropic, recordAiUsage, reserveAiRequest } from "@/server/anthropic";
import { budgetState } from "@/server/budget";
import { specialDayPrompt } from "@/core/special-days";
import { upcomingDaysFor } from "@/server/special-days";
import { db } from "@/server/db";
import { coupleSettings, datePlans, deckCards, deckSwipes, ideas, users } from "@/server/db/schema";
import { env } from "@/server/env";
import { upcomingEvents, type EventWithSource } from "@/server/events";
import { CURATED_IDEAS } from "@/core/curated-ideas";
import { getCoupleSettings } from "@/server/settings";
import { weatherFor } from "@/server/weather";

export const DECK_MODEL = "claude-haiku-5-5";
/** A refill that started longer ago than this is considered dead. */
export const STALE_REFILL_MS = 5 * 60_000;
const COMBO_EVENT_DAYS = 14;
const MAX_PROMPT_EVENTS = 12;

const ResultSchema = z.object({
  cards: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      emoji: z.string().nullable(),
      size: z.enum(["small", "large"]),
      cost_eur: z.number().nullable(),
      location: z.string().nullable(),
      setting: z.enum(["indoor", "outdoor"]),
      theme: z.string().nullable(),
      wildcard: z.boolean(),
      event_index: z.number().int().nullable(),
      best_season: z.enum(["any", "spring", "summer", "autumn", "winter"]),
      color: z.enum(CARD_COLORS),
      // Checked against the library afterwards (cleanCardArt): one unknown key must not lose the whole batch.
      illustrations: z.array(z.string()),
      quips: z.object({ neutral: z.array(z.string()), like: z.array(z.string()), nope: z.array(z.string()) }),
    }),
  ),
});

// --- Making cards ---------------------------------------------------------------------------------------

export type RefillResult = "made" | "not_needed" | "busy" | "limit" | "off" | "failed";

async function claimRefill(coupleId: string, now: Date): Promise<boolean> {
  const rows = await db
    .update(coupleSettings)
    .set({ deckRefillStartedAt: now })
    .where(
      and(
        eq(coupleSettings.coupleId, coupleId),
        or(isNull(coupleSettings.deckRefillStartedAt), lt(coupleSettings.deckRefillStartedAt, new Date(now.getTime() - STALE_REFILL_MS))),
      ),
    )
    .returning({ id: coupleSettings.coupleId });
  return rows.length > 0;
}

async function releaseRefill(coupleId: string): Promise<void> {
  await db.update(coupleSettings).set({ deckRefillStartedAt: null }).where(eq(coupleSettings.coupleId, coupleId));
}

/**
 * Makes a new batch when someone runs low (automatic, from the tick or a page
 * view), or right away ("Mehr davon", optionally matching a filter).
 */
export async function refillDeck(coupleId: string, now: Date, options: { manual?: boolean; focus?: IdeaFilter } = {}): Promise<RefillResult> {
  await getCoupleSettings(coupleId);
  const members = await db.select().from(users).where(eq(users.coupleId, coupleId));
  if (members.length !== 2) return "not_needed";
  if (!options.manual) {
    const [remainingA, remainingB, openTotal, batchesToday] = await Promise.all([
      openCardsFor({ user: members[0], partner: members[1], coupleId }, now).then((r) => r.cards.length),
      openCardsFor({ user: members[1], partner: members[0], coupleId }, now).then((r) => r.cards.length),
      db.$count(deckCards, and(eq(deckCards.coupleId, coupleId), eq(deckCards.status, "open"))),
      aiRequestsToday(coupleId, "deck", now),
    ]);
    if (!needsRefill({ remainingPerPerson: [remainingA, remainingB], openTotal, autoBatchesToday: Math.min(batchesToday, DECK_AUTO_BATCHES_PER_DAY) })) return "not_needed";
  }
  // Without the AI the deck still gets the hand-picked Köln ideas.
  if (!env().ai) return (await curatedBatch(coupleId, Math.floor(DECK_BATCH_SIZE / 2))) ? "made" : "off";
  if (!(await claimRefill(coupleId, new Date()))) return "busy";
  try {
    const requestId = await reserveAiRequest({ coupleId, kind: "deck", model: DECK_MODEL, now });
    if (!requestId) return "limit";
    if (await makeBatch(coupleId, now, requestId, options.focus)) return "made";
  } catch (error) {
    console.error(`[deck] refill for couple ${coupleId} failed`, error instanceof Error ? error.message : error);
  } finally {
    await releaseRefill(coupleId);
  }
  // The AI did not deliver – the Köln ideas keep the deck going.
  return (await curatedBatch(coupleId, CURATED_PER_BATCH)) ? "made" : "failed";
}

async function makeBatch(coupleId: string, now: Date, requestId: string, focus?: IdeaFilter): Promise<boolean> {
  const settings = await getCoupleSettings(coupleId);
  const [cards, swipes, wishlist, past, upcoming, weather, budget] = await Promise.all([
    db
      .select({ title: deckCards.title, key: deckCards.dedupeKey, status: deckCards.status, eventKey: deckCards.eventKey, batch: deckCards.batch })
      .from(deckCards)
      .where(eq(deckCards.coupleId, coupleId))
      .orderBy(desc(deckCards.createdAt)),
    db
      .select({ title: deckCards.title, verdict: deckSwipes.verdict })
      .from(deckSwipes)
      .innerJoin(deckCards, eq(deckCards.id, deckSwipes.cardId))
      .where(and(eq(deckCards.coupleId, coupleId), gt(deckSwipes.createdAt, new Date(now.getTime() - 90 * 86_400_000))))
      .orderBy(desc(deckSwipes.createdAt))
      .limit(200),
    db.select({ title: ideas.title }).from(ideas).where(and(eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt))),
    db.select({ title: datePlans.title }).from(datePlans).where(and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done"))).orderBy(desc(datePlans.startsAt)).limit(30),
    upcomingEvents(coupleId, now, COMBO_EVENT_DAYS),
    weatherFor(now, new Date(now.getTime() + 3 * 86_400_000), now),
    budgetState(coupleId, now),
  ]);
  const batch = (cards.reduce((m, c) => Math.max(m, c.batch), 0) || 0) + 1;
  const usedEvents = new Set(cards.map((c) => c.eventKey).filter(Boolean));
  const events = upcoming.filter((e) => e.startsAt && e.startsAt > now && !usedEvents.has(e.dedupeKey)).slice(0, MAX_PROMPT_EVENTS);
  const combos = comboCount(settings.deckEventMix, events.length);
  const liked = [...new Set(swipes.filter((s) => s.verdict === "like" || s.verdict === "super").map((s) => s.title))];
  const passed = [...new Set(swipes.filter((s) => s.verdict === "nope").map((s) => s.title))];
  const exclude = [...new Set([...cards.map((c) => c.title), ...wishlist.map((w) => w.title), ...past.map((p) => p.title)])];
  const when = (e: (typeof events)[number]) => {
    const t = DateTime.fromJSDate(e.startsAt!, { zone: APP_TIMEZONE }).setLocale("de");
    return e.allDay ? t.toFormat("ccc d. LLL") : t.toFormat("ccc d. LLL, HH:mm 'Uhr'");
  };
  const prompt = buildDeckPrompt({
    now,
    weather,
    themes: pickThemes(batch),
    ideaCount: DECK_BATCH_SIZE - combos,
    events: events.map((e) => ({ title: e.title, when: when(e), venue: e.venue, price: e.priceText })),
    comboCount: combos,
    liked,
    passed,
    exclude,
    focus,
    budgetLeft: budget?.left ?? null,
    specialDays: specialDayPrompt(await upcomingDaysFor(coupleId, now, 30)),
  });

  const response = await anthropic().messages.parse({
    model: DECK_MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
    system: DECK_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  await recordAiUsage(requestId, response.usage);
  if (response.stop_reason === "refusal" || !response.parsed_output) return false;
  // Nothing they have seen, have on the wishlist or already did.
  const existingKeys = [...cards.map((c) => c.key), ...wishlist.map((w) => dedupeKey(w.title)), ...past.map((p) => dedupeKey(p.title))];
  const drafts = cleanDeckCards(response.parsed_output.cards, { existingKeys, eventCount: events.length, maxCombos: combos });
  if (drafts.length === 0) return false;
  // A few hand-picked Köln ideas in every batch.
  const curated = curatedForDeck(CURATED_IDEAS, [...existingKeys, ...drafts.map((d) => d.dedupeKey)], CURATED_PER_BATCH).filter((c) => !focus || matchesFilter(c, focus));
  await insertCards(coupleId, [...drafts, ...curated], events, batch);
  return true;
}

/** Only Köln ideas (no AI configured). False when all of them have been in the deck. */
async function curatedBatch(coupleId: string, count: number): Promise<boolean> {
  const [cards, wishlist, past] = await Promise.all([
    db.select({ key: deckCards.dedupeKey, batch: deckCards.batch }).from(deckCards).where(eq(deckCards.coupleId, coupleId)),
    db.select({ title: ideas.title }).from(ideas).where(and(eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt))),
    db.select({ title: datePlans.title }).from(datePlans).where(and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done"))),
  ]);
  const existingKeys = [...cards.map((c) => c.key), ...wishlist.map((w) => dedupeKey(w.title)), ...past.map((p) => dedupeKey(p.title))];
  const drafts = curatedForDeck(CURATED_IDEAS, existingKeys, count);
  if (drafts.length === 0) return false;
  await insertCards(coupleId, drafts, [], cards.reduce((m, c) => Math.max(m, c.batch), 0) + 1);
  return true;
}

async function insertCards(coupleId: string, drafts: CardDraft[], events: EventWithSource[], batch: number): Promise<void> {
  await db
    .insert(deckCards)
    .values(
      drafts.map((d) => {
        const event = d.eventIndex === null ? null : events[d.eventIndex];
        return {
          coupleId,
          kind: d.kind,
          title: d.title,
          note: d.note,
          size: d.size,
          costEur: d.costEur,
          location: d.location,
          setting: d.setting,
          theme: d.theme,
          emoji: d.emoji,
          color: d.color,
          illustrations: d.illustrations,
          quips: d.quips,
          wildcard: d.wildcard,
          bestSeason: d.bestSeason,
          dedupeKey: d.dedupeKey,
          eventTitle: event?.title ?? null,
          eventStartsAt: event?.startsAt ?? null,
          eventEndsAt: event?.endsAt ?? null,
          eventAllDay: event?.allDay ?? false,
          eventVenue: event?.venue ?? null,
          eventUrl: event?.url ?? null,
          eventKey: event?.dedupeKey ?? null,
          batch,
        };
      }),
    )
    .onConflictDoNothing();
}

