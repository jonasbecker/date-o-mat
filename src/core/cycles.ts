// Cycle rules ("Runden"): when a round starts and ends, its deadline, whose turn it is.
// Pure functions in Europe/Berlin wall-clock time (Luxon), so DST is handled.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type CycleStatus, type DateStatus, type Rhythm } from "@/lib/domain";

/** Minimum length of a round – a rhythm change never produces a 1-day round. */
const MIN_DAYS: Record<Rhythm, number> = { weekly: 3, biweekly: 8, semimonthly: 3, monthly: 7 };

function isBoundary(rhythm: Rhythm, day: DateTime): boolean {
  if (rhythm === "weekly" || rhythm === "biweekly") return day.weekday === 1; // Monday
  if (rhythm === "semimonthly") return day.day === 1 || day.day === 16;
  return day.day === 1;
}

function firstBoundaryOnOrAfter(rhythm: Rhythm, t: DateTime): DateTime {
  let day = t.startOf("day");
  if (day < t) day = day.plus({ days: 1 });
  while (!isBoundary(rhythm, day)) day = day.plus({ days: 1 });
  return day;
}

/** Start of the round that contains `now` (used for the very first round). */
export function alignedCycleStart(rhythm: Rhythm, now: Date, zone = APP_TIMEZONE): Date {
  const local = DateTime.fromJSDate(now, { zone });
  if (rhythm === "weekly" || rhythm === "biweekly") return local.startOf("week").toJSDate();
  if (rhythm === "semimonthly") {
    return (local.day < 16 ? local.startOf("month") : local.set({ day: 16 }).startOf("day")).toJSDate();
  }
  return local.startOf("month").toJSDate();
}

/** End of a round starting at `start`: the next rhythm boundary after the minimum length. */
export function cycleEnd(rhythm: Rhythm, start: Date, zone = APP_TIMEZONE): Date {
  const local = DateTime.fromJSDate(start, { zone });
  return firstBoundaryOnOrAfter(rhythm, local.plus({ days: MIN_DAYS[rhythm] })).toJSDate();
}

/**
 * Planning deadline: `daysBeforeEnd` days before the last day of the round,
 * at `minuteOfDay` (weekly Mon–Sun, 3 days, 20:00 → Thursday 20:00).
 * Never earlier than 12 hours into the round, never after its end.
 */
export function cycleDeadline(start: Date, end: Date, daysBeforeEnd: number, minuteOfDay: number, zone = APP_TIMEZONE): Date {
  const lastDay = DateTime.fromJSDate(end, { zone }).minus({ days: 1 }).startOf("day");
  const deadline = lastDay
    .minus({ days: daysBeforeEnd })
    .set({ hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 })
    .toMillis();
  const earliest = start.getTime() + 12 * 3_600_000;
  return new Date(Math.min(Math.max(deadline, earliest), end.getTime()));
}

/** Alternating mode: round 1 → first planner, round 2 → the other one, and so on. */
export function plannerForSeq(seq: number, firstPlannerId: string, otherId: string): string {
  return seq % 2 === 1 ? firstPlannerId : otherId;
}

export type DateSummary = { status: DateStatus; endsAt: Date };

/**
 * Status of a round given its (latest, non-cancelled) date and the time:
 * a date that is over counts as done; a round that ends without a date is skipped.
 */
export function cycleStatus(params: {
  current: CycleStatus;
  date: DateSummary | null;
  cycleEnd: Date;
  now: Date;
}): CycleStatus {
  const { current, date, cycleEnd: end, now } = params;
  if (current === "done" || current === "skipped") return current;
  if (date && date.status !== "cancelled") {
    if (date.status === "done" || date.endsAt <= now) return "done";
    return date.status === "confirmed" ? "confirmed" : "planned";
  }
  return end <= now ? "skipped" : "open";
}
