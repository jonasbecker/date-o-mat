// The swipe deck ("Entdecken"): stores Claude's cards, the swipes of both,
// matches (→ wishlist) and refills the deck in the background.
import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, desc, eq, gt, inArray, isNull, lt, max, ne, or } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import { outOfQuietHours } from "@/core/reminders";
import {
  buildDeckPrompt,
  cleanDeckCards,
  comboCount,
  DECK_AUTO_BATCHES_PER_DAY,
  DECK_BATCH_SIZE,
  DECK_SYSTEM_PROMPT,
  dedupeKey,
  needsRefill,
  NUDGE_MIN_LIKES,
  orderDeck,
  maybeRevisitAt,
  pickThemes,
  REVISIT_AFTER_DAYS,
  revisitOutcome,
  superLikeLeft,
  swipeOutcome,
  type DeckCardView,
  type DeckFilter,
  type SwipeOutcome,
} from "@/core/deck";
import { APP_TIMEZONE, type SwipeVerdict } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { aiRequestsToday, anthropic, recordAiUsage, reserveAiRequest } from "@/server/anthropic";
import { budgetState } from "@/server/budget";
import { specialDayPrompt } from "@/core/special-days";
import { upcomingDaysFor } from "@/server/special-days";
import { db } from "@/server/db";
import { coupleSettings, datePlans, deckCards, deckSwipes, ideas, notificationLog, users, type DeckCard } from "@/server/db/schema";
import { env } from "@/server/env";
import { freeForEvents, upcomingEvents } from "@/server/events";
import { sendToUser } from "@/server/push";
import { getCoupleSettings } from "@/server/settings";
import { weatherFor } from "@/server/weather";

export const DECK_MODEL = "claude-haiku-5-5";
/** A refill that started longer ago than this is considered dead. */
const STALE_REFILL_MS = 5 * 60_000;
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
    }),
  ),
});

// --- Reading -------------------------------------------------------------------------------------

/** Combo cards stay until their event starts (all-day events: until the end of that day). */
function stillValid(card: Pick<DeckCard, "eventStartsAt" | "eventAllDay">, now: Date): boolean {
  if (!card.eventStartsAt) return true;
  const until = card.eventAllDay ? DateTime.fromJSDate(card.eventStartsAt, { zone: APP_TIMEZONE }).endOf("day").toJSDate() : card.eventStartsAt;
  return until > now;
}

function eventWhen(startsAt: Date, allDay: boolean): string {
  const t = DateTime.fromJSDate(startsAt, { zone: APP_TIMEZONE }).setLocale("de");
  return allDay ? t.toFormat("cccc, d. LLLL") : t.toFormat("cccc, d. LLLL, HH:mm 'Uhr'");
}

export function cardView(card: DeckCard, partnerVerdict: SwipeVerdict | undefined): DeckCardView {
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
  };
}

/** Open cards one person has not swiped yet, in their order. */
async function openCardsFor(ctx: CoupleContext, now: Date): Promise<{ cards: DeckCard[]; partner: Map<string, SwipeVerdict> }> {
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

export type DeckState = {
  cards: DeckCardView[];
  /** Put on "Vielleicht", coming back later. */
  maybes: number;
  superLeft: boolean;
  /** A batch is being made right now. */
  generating: boolean;
  matches: number;
  ai: boolean;
};

export async function deckFor(ctx: CoupleContext, now: Date): Promise<DeckState> {
  const [{ cards, partner }, lastSuper, settings, matches, maybes] = await Promise.all([
    openCardsFor(ctx, now),
    lastSuperLike(ctx.user.id),
    getCoupleSettings(ctx.coupleId),
    db.$count(deckCards, and(eq(deckCards.coupleId, ctx.coupleId), eq(deckCards.status, "matched"), ne(deckCards.kind, "revisit"))),
    maybeCount(ctx, now),
  ]);
  const since = await waitingSinceLabels(cards, now);
  const views = cards.map((card) => ({ ...cardView(card, partner.get(card.id)), waitingSince: since.get(card.id) ?? null }));
  // "✓ Ihr habt beide Zeit" for combo cards – one FreeBusy query per person.
  const combos = cards.filter((c) => c.kind === "combo" && c.eventStartsAt);
  if (combos.length) {
    const free = await freeForEvents(
      ctx,
      combos.map((c) => ({ id: c.id, startsAt: c.eventStartsAt, endsAt: c.eventEndsAt, allDay: c.eventAllDay })),
    );
    for (const view of views) if (view.kind === "combo") view.bothFree = free?.get(view.id) ?? null;
  }
  const refillAt = settings.deckRefillStartedAt;
  return {
    cards: views,
    maybes,
    superLeft: superLikeLeft(lastSuper, new Date()),
    generating: Boolean(refillAt && Date.now() - refillAt.getTime() < STALE_REFILL_MS),
    matches,
    ai: env().ai,
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

export type SwipeResult =
  | { ok: true; outcome: SwipeOutcome; title: string; match: { ideaId: string; title: string } | null }
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
      return { ok: true, outcome, title: card.title, match: null } as const;
    }
    const outcome = swipeOutcome(verdict, partner?.verdict ?? null);
    if (outcome === "pass") {
      await tx.update(deckCards).set({ status: "passed" }).where(eq(deckCards.id, cardId));
      return { ok: true, outcome, title: card.title, match: null } as const;
    }
    if (outcome === "match") {
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
          source: "deck",
          externalRef: card.id,
          createdById: ctx.user.id,
          updatedById: ctx.user.id,
        })
        .returning({ id: ideas.id });
      await tx.update(deckCards).set({ status: "matched", matchedAt: new Date(), ideaId: idea.id }).where(eq(deckCards.id, cardId));
      return { ok: true, outcome, title: card.title, match: { ideaId: idea.id, title: card.title } } as const;
    }
    return { ok: true, outcome, title: card.title, match: null } as const;
  });
}

export type UndoResult = { ok: true; card: DeckCardView } | { ok: false; error: "nothing" | "planned" };

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
    } else if (card.status === "matched" && card.ideaId) {
      // Already planned as a date: the match stays.
      const used = await tx.$count(datePlans, eq(datePlans.ideaId, card.ideaId));
      if (used > 0) return { ok: false, error: "planned" } as const;
      await tx.delete(ideas).where(and(eq(ideas.id, card.ideaId), eq(ideas.coupleId, ctx.coupleId)));
    }
    await tx
      .update(deckCards)
      .set({ status: "open", matchedAt: null, ideaId: card.kind === "revisit" ? card.ideaId : null })
      .where(eq(deckCards.id, card.id));
    await tx.delete(deckSwipes).where(and(eq(deckSwipes.cardId, card.id), eq(deckSwipes.userId, ctx.user.id)));
    const [partner] = await tx
      .select({ verdict: deckSwipes.verdict })
      .from(deckSwipes)
      .where(and(eq(deckSwipes.cardId, card.id), eq(deckSwipes.userId, ctx.partner.id)));
    return { ok: true, card: cardView({ ...card, status: "open" }, partner?.verdict) } as const;
  });
}

// --- Notifications ------------------------------------------------------------------------------------

export async function notifyMatch(ctx: CoupleContext, match: { ideaId: string; title: string }): Promise<void> {
  const url = `/plan?idea=${match.ideaId}`;
  try {
    await Promise.all([
      sendToUser(ctx.partner.id, { title: "Match! 💞", body: `Ihr wollt beide: ${match.title}. Gleich planen?`, url, tag: "match" }, "match"),
      sendToUser(ctx.user.id, { title: "Match! 💞", body: `Ihr wollt beide: ${match.title}. Steht auf eurer Wunschliste.`, url, tag: "match" }, "match"),
    ]);
  } catch (error) {
    console.warn("[deck] match push failed", error instanceof Error ? error.message : error);
  }
}

export async function notifySuperLike(ctx: CoupleContext, title: string): Promise<void> {
  try {
    await sendToUser(
      ctx.partner.id,
      { title: `⭐ ${ctx.user.name} findet etwas super`, body: `„${title}“ – wischst du auch nach rechts?`, url: "/ideas/entdecken", tag: "deck" },
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
      { title: `${partner.name} hat ${waiting} Ideen geliked 👀`, body: "Wisch mal durch – vielleicht habt ihr ein Match.", url: "/ideas/entdecken", tag: "deck" },
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
export async function refillDeck(coupleId: string, now: Date, options: { manual?: boolean; focus?: DeckFilter } = {}): Promise<RefillResult> {
  if (!env().ai) return "off";
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
  if (!(await claimRefill(coupleId, new Date()))) return "busy";
  try {
    const requestId = await reserveAiRequest({ coupleId, kind: "deck", model: DECK_MODEL, now });
    if (!requestId) return "limit";
    return (await makeBatch(coupleId, now, requestId, options.focus)) ? "made" : "failed";
  } catch (error) {
    console.error(`[deck] refill for couple ${coupleId} failed`, error instanceof Error ? error.message : error);
    return "failed";
  } finally {
    await releaseRefill(coupleId);
  }
}

async function makeBatch(coupleId: string, now: Date, requestId: string, focus?: DeckFilter): Promise<boolean> {
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
  const combos = focus === "events" ? Math.min(events.length, 8) : comboCount(settings.deckEventMix, events.length);
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
    ideaCount: focus === "events" ? Math.max(4, DECK_BATCH_SIZE - combos * 2) : DECK_BATCH_SIZE - combos,
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
  return true;
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
