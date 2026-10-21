"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { addTask, deleteTask, toggleTask } from "@/server/date-tasks";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { applySettingsToOpenCycle, ensureCurrentCycle } from "@/server/cycles";
import { cancelDate, confirmDate, getDate, markNotHappened, saveDate } from "@/server/dates";
import { notifyPartner, notifyTurnHandedOver, nudgePartner, type PartnerEvent } from "@/server/notifications";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { suggestions } from "@/server/db/schema";
import { DATE_ERROR_MESSAGES } from "@/lib/date-errors";
import { getCoupleSettings, setFirstPlanner } from "@/server/settings";
import { rejectSuggestion } from "@/server/suggestions";

/**
 * Alternating mode: `plannerId` takes over this round (and the order flips from here on). The button
 * says who should plan, not "swap" – a double tap or a stale page must not hand the turn back.
 */
export async function swapTurnAction(plannerId: string) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  const newPlanner = [user.id, partner.id].find((id) => id === plannerId);
  if (newPlanner && cycle?.status === "open" && cycle.mode === "alternating" && cycle.plannerId && cycle.plannerId !== newPlanner) {
    const otherId = newPlanner === user.id ? partner.id : user.id;
    // plannerForSeq: odd rounds → first planner. Pick the first planner so this round goes to newPlanner.
    await setFirstPlanner(coupleId, cycle.seq % 2 === 1 ? newPlanner : otherId);
    await applySettingsToOpenCycle(coupleId, now);
    after(() => notifyTurnHandedOver(ctx, newPlanner === partner.id));
  }
  refresh();
}

export async function rejectSuggestionAction(suggestionId: string) {
  const { user, coupleId } = await requireCouple();
  const id = z.uuid().safeParse(suggestionId);
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  if (id.success && cycle) {
    await rejectSuggestion(cycle.id, id.data, user.id, now);
  }
  refresh();
}

// --- Dates ------------------------------------------------------------------------

/** Push to the partner after the response has been sent. */
async function tellPartner(ctx: CoupleContext, event: PartnerEvent, dateId: string) {
  const date = await getDate(ctx.coupleId, dateId);
  if (date) after(() => notifyPartner(ctx, event, date));
}

export type ActionResult = { ok: boolean; message?: string };

const dateIdSchema = z.uuid();

/** "Passt!" */
export async function confirmDateAction(dateId: string): Promise<ActionResult> {
  const ctx = await requireCouple();
  const id = dateIdSchema.safeParse(dateId);
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const ok = id.success && (await confirmDate(ctx, id.data, now));
  if (ok) await tellPartner(ctx, "confirmed", id.data);
  refresh();
  return ok ? { ok } : { ok, message: "Das Date wurde inzwischen geändert – schau nochmal drauf." };
}

export async function cancelDateAction(dateId: string): Promise<ActionResult> {
  const ctx = await requireCouple();
  const id = dateIdSchema.safeParse(dateId);
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const ok = id.success && (await cancelDate(ctx, id.data, now));
  if (ok) {
    await tellPartner(ctx, "cancelled", id.data);
    // "Absagen" sits on the date's own page – which is gone now: back to the start.
    redirect("/plan");
  }
  refresh();
  return { ok };
}

export async function notHappenedAction(dateId: string): Promise<void> {
  const ctx = await requireCouple();
  const id = dateIdSchema.safeParse(dateId);
  if (id.success) await markNotHappened(ctx, id.data, coupleNow(await getCoupleSettings(ctx.coupleId)));
  refresh();
}

/** Suggestion mode: take the proposal as it is – you become the organizer. */
export async function acceptSuggestionAction(suggestionId: string): Promise<ActionResult> {
  const ctx = await requireCouple();
  const id = z.uuid().safeParse(suggestionId);
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  if (!id.success || !cycle) return { ok: false };
  const [suggestion] = await db
    .select()
    .from(suggestions)
    .where(and(eq(suggestions.id, id.data), eq(suggestions.cycleId, cycle.id), eq(suggestions.status, "pending")))
    .limit(1);
  if (!suggestion) return { ok: false, message: "Diesen Vorschlag gibt es nicht mehr." };
  const result = await saveDate(
    ctx,
    {
      start: suggestion.startsAt,
      end: suggestion.endsAt,
      size: suggestion.size,
      ideaId: suggestion.ideaId,
      customTitle: suggestion.ideaId ? null : "Zeit zu zweit",
      customLocation: null,
    },
    now,
    undefined,
    suggestion.id,
  );
  if (result.ok) await tellPartner(ctx, "planned", result.dateId);
  refresh();
  return result.ok ? { ok: true } : { ok: false, message: DATE_ERROR_MESSAGES[result.error] };
}

// --- Preparation checklist ---------------------------------------------------------------

export async function addTaskAction(dateId: string, title: string): Promise<ActionResult> {
  const ctx = await requireCouple();
  const id = dateIdSchema.safeParse(dateId);
  const ok = id.success && typeof title === "string" && (await addTask(ctx, id.data, title));
  refresh();
  return ok ? { ok } : { ok, message: "Das ging nicht – ist die Liste voll?" };
}

export async function toggleTaskAction(taskId: string, done: boolean): Promise<void> {
  const { coupleId } = await requireCouple();
  if (dateIdSchema.safeParse(taskId).success) await toggleTask(coupleId, taskId, done === true);
  refresh();
}

export async function deleteTaskAction(taskId: string): Promise<void> {
  const { coupleId } = await requireCouple();
  if (dateIdSchema.safeParse(taskId).success) await deleteTask(coupleId, taskId);
  refresh();
}

/** "Anstupsen": a push to the one who has the watering can – to plan, or to say yes to the plan. */
export async function nudgeAction(): Promise<ActionResult> {
  const ctx = await requireCouple();
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  if (!cycle) return { ok: false, message: "Gerade läuft keine Runde." };
  const text =
    cycle.status === "planned"
      ? { title: `${ctx.user.name} stupst dich an 👋`, body: "Euer Date wartet auf dein „Zusagen“." }
      : { title: `${ctx.user.name} stupst dich an 👋`, body: "Die Gießkanne ist bei dir – plant ihr was?" };
  const sent = await nudgePartner(ctx, cycle.id, now, text);
  const name = ctx.partner.name;
  if (sent === null) return { ok: false, message: "Gerade erst angestupst – in einer Stunde wieder." };
  // Nobody would see it: better say so than pretend.
  if (sent === 0) return { ok: false, message: `${name} hat Push aus – sag's lieber direkt.` };
  return { ok: true, message: `${name} ist angestupst.` };
}
