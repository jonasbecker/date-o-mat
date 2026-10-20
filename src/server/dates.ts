// Dates ("date_plans"): plan, reschedule, confirm, cancel – and keep the
// Google Calendar event in sync with the database.
import "server-only";
import { and, asc, eq, gt, inArray, isNull, lt, lte, ne } from "drizzle-orm";
import { parsePriceEur } from "@/core/budget";
import { buildEventBody, eventIdFor } from "@/core/date-event";
import { maskSurprise, surpriseRevealAt } from "@/core/date-extras";
import { mergeRanges, padRanges, subtractRanges, type TimeRange } from "@/core/ranges";
import type { IdeaSize } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { db } from "@/server/db";
import { cycles, datePlans, events, ideas, suggestions, users, type DatePlan } from "@/server/db/schema";
import { env } from "@/server/env";
import { formatTimeRange } from "@/lib/format";
import { sendToUser } from "@/server/push";
import { deleteEvent, getEvent, insertEvent, patchEvent, queryFreeBusy } from "@/server/google/calendar-api";
import { CalendarNotConnectedError, getConnection } from "@/server/google/connection";
import { ensureCurrentCycle } from "@/server/cycles";
import { getCoupleSettings } from "@/server/settings";

const MAX_SYNC_ATTEMPTS = 10;

export type DateChoice = {
  start: Date;
  end: Date;
  size: IdeaSize;
  /** Idea from the wishlist … */
  ideaId: string | null;
  /** … or a spontaneous one … */
  customTitle: string | null;
  customLocation: string | null;
  /** … or an event found on an event source. */
  eventId?: string | null;
  /** Paid from the savings pot instead of the month budget. */
  fromPot?: boolean;
  /** Surprise: the partner sees only time and hint until the day. Undefined = keep as it is. */
  surprise?: { hint: string | null } | null;
  /** Rescheduling someone else's surprise: only the time changes. */
  keepDetails?: boolean;
};

/**
 * What a viewer may see of a date: a surprise not planned by them shows only
 * time and hint until the day itself. `viewerId` null = the shared Google event.
 */
export function dateForViewer<T extends DatePlan>(date: T, viewerId: string | null, people: Array<{ id: string; name: string }>, now: Date): T {
  const organizer = people.find((p) => p.id === date.organizerId)?.name ?? "deinem Schatz";
  return maskSurprise(date, viewerId, now, organizer);
}

export type SaveDateResult =
  | { ok: true; dateId: string; synced: boolean }
  | { ok: false; error: "taken" | "not_connected" | "google" | "round_has_date" | "invalid" | "no_round" };

// --- Queries -----------------------------------------------------------------------

/** The next date that has not happened yet (from any round). */
/** How many dates they have had – some extras only show up after the first. */
export async function countDoneDates(coupleId: string): Promise<number> {
  return db.$count(datePlans, and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done")));
}

/** How many dates were lived up to (and including) this start – the Nº of its leaf. */
export async function countDoneDatesUntil(coupleId: string, startsAt: Date): Promise<number> {
  return db.$count(datePlans, and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done"), lte(datePlans.startsAt, startsAt)));
}

export async function upcomingDate(coupleId: string, now: Date): Promise<DatePlan | undefined> {
  const [date] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), inArray(datePlans.status, ["planned", "confirmed"]), gt(datePlans.endsAt, now)))
    .orderBy(asc(datePlans.startsAt))
    .limit(1);
  return date;
}

export async function getDate(coupleId: string, dateId: string): Promise<DatePlan | undefined> {
  const [date] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.id, dateId), eq(datePlans.coupleId, coupleId)))
    .limit(1);
  return date;
}

// --- Availability check right before saving ------------------------------------------

/**
 * Asks Google again whether both are still free at [start, end] (plus buffer).
 * When rescheduling, the date's own old time does not count as busy.
 */
async function isStillFree(ctx: CoupleContext, start: Date, end: Date, ignore?: TimeRange): Promise<boolean> {
  const settings = await getCoupleSettings(ctx.coupleId);
  const buffer = settings.bufferMinutes * 60_000;
  const from = new Date(start.getTime() - buffer);
  const to = new Date(end.getTime() + buffer);
  const results = await Promise.all(
    [ctx.user, ctx.partner].map(async (person) => {
      const connection = await getConnection(person.id);
      return queryFreeBusy(person.id, connection?.busyCalendarIds ?? ["primary"], from, to);
    }),
  );
  let busy = mergeRanges(padRanges(results.flatMap((r) => r.busy), buffer));
  if (ignore) busy = busy.flatMap((range) => subtractRanges(range, [ignore]));
  return !busy.some((range) => range.start < end.getTime() && range.end > start.getTime());
}

// --- Plan / reschedule ---------------------------------------------------------------

async function snapshot(coupleId: string, choice: DateChoice) {
  if (choice.eventId) {
    const [event] = await db
      .select()
      .from(events)
      .where(and(eq(events.id, choice.eventId), eq(events.coupleId, coupleId)))
      .limit(1);
    if (!event) return null;
    const note = [event.priceText, event.summary].filter(Boolean).join(" · ") || null;
    return { ideaId: null, title: event.title, location: event.venue, note, url: event.url, estimatedCostEur: parsePriceEur(event.priceText) };
  }
  if (choice.ideaId) {
    const [idea] = await db
      .select()
      .from(ideas)
      .where(and(eq(ideas.id, choice.ideaId), eq(ideas.coupleId, coupleId)))
      .limit(1);
    if (!idea) return null;
    return { ideaId: idea.id, title: idea.title, location: idea.location, note: idea.note, url: idea.url, estimatedCostEur: idea.costEur };
  }
  if (!choice.customTitle) return null;
  return { ideaId: null, title: choice.customTitle, location: choice.customLocation, note: null, url: null, estimatedCostEur: null };
}

/**
 * Plans a date in the current round (or moves an existing one when `dateId`
 * is given). The person who saves becomes the proposer; the other one confirms.
 */
export async function saveDate(ctx: CoupleContext, choice: DateChoice, now: Date, dateId?: string, suggestionId?: string): Promise<SaveDateResult> {
  const settings = await getCoupleSettings(ctx.coupleId);
  const duration = choice.end.getTime() - choice.start.getTime();
  if (duration <= 0 || duration > 12 * 3_600_000) return { ok: false, error: "invalid" };
  if (choice.start.getTime() < now.getTime() + Math.min(settings.minLeadHours, 2) * 3_600_000) return { ok: false, error: "invalid" };

  const existing = dateId ? await getDate(ctx.coupleId, dateId) : undefined;
  if (dateId && (!existing || !["planned", "confirmed"].includes(existing.status))) return { ok: false, error: "invalid" };

  const details =
    choice.keepDetails && existing
      ? { ideaId: existing.ideaId, title: existing.title, location: existing.location, note: existing.note, url: existing.url, estimatedCostEur: existing.estimatedCostEur }
      : await snapshot(ctx.coupleId, choice);
  if (!details) return { ok: false, error: "invalid" };

  try {
    const ignore = existing ? { start: existing.startsAt.getTime(), end: existing.endsAt.getTime() } : undefined;
    if (!(await isStillFree(ctx, choice.start, choice.end, ignore))) return { ok: false, error: "taken" };
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) return { ok: false, error: "not_connected" };
    console.error("[dates] availability check failed", error);
    return { ok: false, error: "google" };
  }

  let savedId: string;
  if (existing) {
    await db
      .update(datePlans)
      .set({
        ...details,
        size: choice.size,
        startsAt: choice.start,
        endsAt: choice.end,
        fromPot: choice.fromPot ?? existing.fromPot,
        ...(choice.surprise !== undefined ? { surprise: choice.surprise !== null, surpriseHint: choice.surprise?.hint ?? null, surpriseRevealedAt: null } : {}),
        status: "planned",
        proposedById: ctx.user.id,
        confirmedById: null,
        confirmedAt: null,
        syncStatus: "pending",
        syncAttempts: 0,
      })
      .where(eq(datePlans.id, existing.id));
    savedId = existing.id;
  } else {
    const cycle = await ensureCurrentCycle(ctx.coupleId, now);
    if (!cycle) return { ok: false, error: "no_round" };
    // Lock the round so two people pressing "festlegen" at once cannot create two dates.
    const created = await db.transaction(async (tx) => {
      await tx.select({ id: cycles.id }).from(cycles).where(eq(cycles.id, cycle.id)).for("update");
      const [active] = await tx
        .select({ id: datePlans.id })
        .from(datePlans)
        .where(and(eq(datePlans.cycleId, cycle.id), ne(datePlans.status, "cancelled")))
        .limit(1);
      if (active) return null;
      const [row] = await tx
        .insert(datePlans)
        .values({
          ...details,
          coupleId: ctx.coupleId,
          cycleId: cycle.id,
          size: choice.size,
          startsAt: choice.start,
          endsAt: choice.end,
          fromPot: choice.fromPot ?? false,
          surprise: Boolean(choice.surprise),
          surpriseHint: choice.surprise?.hint ?? null,
          organizerId: ctx.user.id,
          proposedById: ctx.user.id,
        })
        .returning({ id: datePlans.id });
      if (suggestionId) {
        await tx
          .update(suggestions)
          .set({ status: "accepted", decidedById: ctx.user.id, decidedAt: now })
          .where(and(eq(suggestions.id, suggestionId), eq(suggestions.cycleId, cycle.id)));
      }
      return row;
    });
    if (!created) return { ok: false, error: "round_has_date" };
    savedId = created.id;
  }

  await ensureCurrentCycle(ctx.coupleId, now); // round status → planned
  const synced = await syncDate(savedId);
  return { ok: true, dateId: savedId, synced };
}

export type SwapIdeaResult = { ok: true; date: DatePlan } | { ok: false; error: "invalid" | "surprise" | "same" };

/**
 * "Statt „X“ lieber „Y“": the next date keeps its time, only what you do changes.
 * A "Passt!" stays – the time is still the same. Someone else's hidden surprise is theirs to change.
 */
export async function swapDateIdea(ctx: CoupleContext, dateId: string, ideaId: string, now: Date): Promise<SwapIdeaResult> {
  const existing = await getDate(ctx.coupleId, dateId);
  if (!existing || !["planned", "confirmed"].includes(existing.status) || existing.endsAt <= now) return { ok: false, error: "invalid" };
  if (dateForViewer(existing, ctx.user.id, [ctx.user, ctx.partner], now) !== existing) return { ok: false, error: "surprise" };
  if (existing.ideaId === ideaId) return { ok: false, error: "same" };
  const details = await snapshot(ctx.coupleId, { start: existing.startsAt, end: existing.endsAt, size: existing.size, ideaId, customTitle: null, customLocation: null });
  if (!details) return { ok: false, error: "invalid" };
  const [date] = await db
    .update(datePlans)
    .set({ ...details, syncStatus: "pending", syncAttempts: 0 })
    .where(eq(datePlans.id, existing.id))
    .returning();
  await syncDate(date.id);
  return { ok: true, date };
}

/** "Passt!" – only the person who did not propose the current time can confirm. */
export async function confirmDate(ctx: CoupleContext, dateId: string, now: Date): Promise<boolean> {
  const updated = await db
    .update(datePlans)
    .set({ status: "confirmed", confirmedById: ctx.user.id, confirmedAt: now })
    .where(
      and(
        eq(datePlans.id, dateId),
        eq(datePlans.coupleId, ctx.coupleId),
        eq(datePlans.status, "planned"),
        ne(datePlans.proposedById, ctx.user.id),
      ),
    )
    .returning({ id: datePlans.id });
  await ensureCurrentCycle(ctx.coupleId, now);
  return updated.length > 0;
}

/** Cancels the date; the Google event is deleted and the guest notified. The round reopens. */
export async function cancelDate(ctx: CoupleContext, dateId: string, now: Date): Promise<boolean> {
  const updated = await db
    .update(datePlans)
    .set({ status: "cancelled", cancelledAt: now, syncStatus: "pending", syncAttempts: 0 })
    .where(and(eq(datePlans.id, dateId), eq(datePlans.coupleId, ctx.coupleId), inArray(datePlans.status, ["planned", "confirmed"])))
    .returning({ id: datePlans.id });
  if (!updated.length) return false;
  await ensureCurrentCycle(ctx.coupleId, now);
  await syncDate(dateId);
  return true;
}

/** After the fact: "it did not happen after all" – the round counts as skipped. */
export async function markNotHappened(ctx: CoupleContext, dateId: string): Promise<boolean> {
  const date = await getDate(ctx.coupleId, dateId);
  if (!date || date.status !== "done") return false;
  await db.update(datePlans).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(datePlans.id, date.id));
  await db.update(cycles).set({ status: "skipped" }).where(eq(cycles.id, date.cycleId));
  return true;
}

// --- Google Calendar sync -------------------------------------------------------------

async function partnerEmailOf(date: DatePlan): Promise<string | null> {
  const [partner] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.coupleId, date.coupleId), ne(users.id, date.organizerId)))
    .limit(1);
  return partner?.email ?? null;
}

/**
 * Makes the organizer's Google event match the database: create, update or
 * delete. Safe to repeat (fixed event id). Failures are stored and retried by the tick.
 */
export async function syncDate(dateId: string): Promise<boolean> {
  const [date] = await db.select().from(datePlans).where(eq(datePlans.id, dateId)).limit(1);
  if (!date) return false;
  const eventId = date.googleEventId ?? eventIdFor(date.id);

  try {
    if (date.status === "cancelled") {
      if (date.googleEventId) await deleteEvent(date.organizerId, eventId);
    } else {
      const partnerEmail = await partnerEmailOf(date);
      if (!partnerEmail) throw new Error("Couple has no partner");
      const [idea] = date.ideaId
        ? await db.select({ costEur: ideas.costEur }).from(ideas).where(eq(ideas.id, date.ideaId)).limit(1)
        : [];
      // A surprise stays a surprise in Google Calendar too (the partner is invited to the same event).
      const now = coupleNow(await getCoupleSettings(date.coupleId));
      const people = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.coupleId, date.coupleId));
      const shown = dateForViewer(date, null, people, now);
      const hidden = shown !== date;
      const body = buildEventBody({ ...shown, costEur: hidden ? null : (idea?.costEur ?? null) }, partnerEmail, env().appUrl);
      const created = date.googleEventId ? false : await insertEvent(date.organizerId, eventId, body);
      if (!created) await patchEvent(date.organizerId, eventId, body);
    }
    await db
      .update(datePlans)
      .set({ googleEventId: date.status === "cancelled" ? date.googleEventId : eventId, syncStatus: "synced", syncError: null })
      .where(eq(datePlans.id, date.id));
    return true;
  } catch (error) {
    const message = error instanceof CalendarNotConnectedError ? "Kalender nicht verbunden" : String(error).slice(0, 500);
    console.error(`[dates] sync of ${date.id} failed`, error);
    await db
      .update(datePlans)
      .set({ syncStatus: "error", syncError: message, syncAttempts: date.syncAttempts + 1 })
      .where(eq(datePlans.id, date.id));
    return false;
  }
}

/** Retries failed or pending syncs (called by the tick). */
export async function retryPendingSyncs(coupleId: string): Promise<void> {
  const pending = await db
    .select({ id: datePlans.id })
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), ne(datePlans.syncStatus, "synced"), lt(datePlans.syncAttempts, MAX_SYNC_ATTEMPTS)));
  for (const { id } of pending) await syncDate(id);
}

/**
 * Reads back upcoming planned dates from Google: if the partner accepted the
 * invitation there, the date counts as confirmed; if the organizer deleted the
 * event in Google Calendar, the date is cancelled in the app as well.
 */
export async function pullGoogleChanges(coupleId: string, now: Date): Promise<void> {
  const open = await db
    .select()
    .from(datePlans)
    .where(
      and(
        eq(datePlans.coupleId, coupleId),
        inArray(datePlans.status, ["planned", "confirmed"]),
        eq(datePlans.syncStatus, "synced"),
        gt(datePlans.endsAt, now),
      ),
    );
  for (const date of open) {
    if (!date.googleEventId) continue;
    try {
      const event = await getEvent(date.organizerId, date.googleEventId);
      if (!event || event.status === "cancelled") {
        await db.update(datePlans).set({ status: "cancelled", cancelledAt: now }).where(eq(datePlans.id, date.id));
        continue;
      }
      const partnerEmail = await partnerEmailOf(date);
      const accepted = event.attendees?.some((a) => a.email.toLowerCase() === partnerEmail && a.responseStatus === "accepted");
      if (accepted && date.status === "planned" && date.proposedById === date.organizerId) {
        await db
          .update(datePlans)
          .set({ status: "confirmed", confirmedAt: now })
          .where(and(eq(datePlans.id, date.id), eq(datePlans.status, "planned")));
      }
    } catch (error) {
      console.warn(`[dates] reading back ${date.id} failed`, error);
    }
  }
}

/**
 * Tick: on the day of a surprise date the event in Google Calendar gets its
 * real title and the partner a push "Heute ist es soweit".
 */
export async function revealSurprises(coupleId: string, now: Date): Promise<void> {
  const due = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), eq(datePlans.surprise, true), isNull(datePlans.surpriseRevealedAt), inArray(datePlans.status, ["planned", "confirmed"])));
  for (const date of due) {
    if (surpriseRevealAt(date.startsAt) > now) continue;
    const [claimed] = await db
      .update(datePlans)
      .set({ surpriseRevealedAt: now, syncStatus: "pending", syncAttempts: 0 })
      .where(and(eq(datePlans.id, date.id), isNull(datePlans.surpriseRevealedAt)))
      .returning({ id: datePlans.id });
    if (!claimed) continue;
    await syncDate(date.id);
    const people = await db.select().from(users).where(eq(users.coupleId, coupleId));
    const organizer = people.find((p) => p.id === date.organizerId);
    const partner = people.find((p) => p.id !== date.organizerId);
    if (!organizer || !partner) continue;
    await sendToUser(
      partner.id,
      { title: "🎁 Heute ist es soweit!", body: `${organizer.name} hat für heute geplant: ${date.title} · ${formatTimeRange(date.startsAt, date.endsAt)} Uhr`, url: `/dates/${date.id}`, tag: "date" },
      "partner_activity",
    ).catch(() => 0);
  }
}
