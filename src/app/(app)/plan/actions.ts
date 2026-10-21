"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { IDEA_SIZES } from "@/lib/domain";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { DATE_ERROR_MESSAGES } from "@/lib/date-errors";
import { getDate, saveDate } from "@/server/dates";
import { notifyPartner } from "@/server/notifications";
import { getCoupleSettings } from "@/server/settings";
import { formatShortDate, slotView, type SlotView } from "@/lib/format";
import { searchSlots } from "@/server/availability";
import { ensureCurrentCycle } from "@/server/cycles";
import { freeForEvents, listSources, savedRefs, upcomingEvents } from "@/server/events";
import { searchUntil } from "@/server/suggestions";
import type { EventView } from "../events/event-list";
import { eventView } from "../events/event-view";

export type SaveDateState = { status: "idle" | "saved" | "error"; message?: string; savedAt?: number; code?: string };

const optionalUuid = z.preprocess((v) => (v === "" || v === null ? undefined : v), z.uuid().optional());
const optionalText = z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : undefined), z.string().max(120).optional());

const schema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  size: z.enum(IDEA_SIZES),
  ideaId: optionalUuid,
  customTitle: optionalText,
  customLocation: optionalText,
  dateId: optionalUuid,
  fromPot: z.literal("1").optional(),
  surprise: z.literal("1").optional(),
  surpriseHint: optionalText,
  keepDetails: z.literal("1").optional(),
});

/** "Date festlegen" (or "Termin ändern" with a dateId). */
export async function saveDateAction(_prev: SaveDateState, formData: FormData): Promise<SaveDateState> {
  const ctx = await requireCouple();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || (!parsed.data.ideaId && !parsed.data.customTitle && !parsed.data.keepDetails)) {
    return { status: "error", message: parsed.success ? "Wähl eine Idee oder schreib eine spontane auf." : DATE_ERROR_MESSAGES.invalid };
  }
  const data = parsed.data;
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const result = await saveDate(
    ctx,
    {
      start: new Date(data.start),
      end: new Date(data.end),
      size: data.size,
      ideaId: data.ideaId ?? null,
      customTitle: data.ideaId ? null : (data.customTitle ?? null),
      customLocation: data.ideaId ? null : (data.customLocation ?? null),
      fromPot: data.fromPot === "1",
      // New dates say whether they are a surprise; a reschedule keeps what it was.
      surprise: data.dateId ? undefined : data.surprise === "1" ? { hint: data.surpriseHint ?? null } : null,
      keepDetails: data.keepDetails === "1",
    },
    now,
    data.dateId,
  );
  if (!result.ok) return { status: "error", message: DATE_ERROR_MESSAGES[result.error], code: result.error };
  const saved = await getDate(ctx.coupleId, result.dateId);
  if (saved) after(() => notifyPartner(ctx, data.dateId ? "rescheduled" : "planned", saved));
  refresh();
  return { status: "saved", savedAt: Date.now() };
}

/** The free times ranked for an outdoor idea (daylight + weather), per length. */
export type SlotViewLists = { small: SlotView[]; large: SlotView[] };

export type FreeTimes =
  | { status: "ok"; small: SlotView[]; large: SlotView[]; outdoor: SlotViewLists; outdoorDark: SlotViewLists; untilLabel: string; failedCalendars: number; events: EventView[] | null }
  | { status: "not_connected" | "google_error" };

/**
 * The free times of both – loaded by the flow when it needs them (not on every
 * view and refresh of the start page). With `events`: events where both are free.
 */
export async function freeTimesAction(input: { later?: boolean; events?: boolean; rescheduleId?: string }): Promise<FreeTimes> {
  const ctx = await requireCouple();
  const settings = await getCoupleSettings(ctx.coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(ctx.coupleId, now);
  // Normally only within the current round; "later" searches the whole horizon.
  const until = cycle && !input.later ? searchUntil(cycle, now, settings.horizonDays) : undefined;
  // Moving a date: its own old time is free for the new one.
  const moving = input.rescheduleId ? await getDate(ctx.coupleId, input.rescheduleId) : undefined;
  const ignore = moving && (moving.status === "planned" || moving.status === "confirmed") ? { start: moving.startsAt.getTime(), end: moving.endsAt.getTime() } : undefined;
  const search = await searchSlots(ctx, now, until, ignore);
  if (search.status !== "ok") return { status: search.status };

  let events: EventView[] | null = null;
  if (input.events && (await listSources(ctx.coupleId)).length > 0) {
    const [list, saved] = await Promise.all([upcomingEvents(ctx.coupleId, now, settings.horizonDays), savedRefs(ctx.coupleId)]);
    const earliest = now.getTime() + 2 * 3_600_000; // same lead time as saving a date
    const plannable = list.filter((e) => e.startsAt && !e.allDay && e.startsAt.getTime() > earliest);
    const free = await freeForEvents(ctx, plannable);
    events = plannable.filter((e) => free?.get(e.id) === true).map((e) => eventView(e, { free: true, saved: saved.has(e.dedupeKey), now }));
  }
  return {
    status: "ok",
    small: search.small.map(slotView),
    large: search.large.map(slotView),
    outdoor: { small: search.outdoor.small.map(slotView), large: search.outdoor.large.map(slotView) },
    outdoorDark: { small: search.outdoorDark.small.map(slotView), large: search.outdoorDark.large.map(slotView) },
    untilLabel: formatShortDate(search.until),
    failedCalendars: search.failedCalendars,
    events,
  };
}
