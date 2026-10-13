// Which reminders are due? Pure: rounds, dates and the clock go in, a list of
// reminders comes out. The tick sends each one at most once (notification_log).

import { DateTime } from "luxon";
import { APP_TIMEZONE, type CycleStatus, type DateStatus, type NotificationType, type PlanMode } from "@/lib/domain";

export type ReminderCycle = {
  id: string;
  seq: number;
  startsAt: Date;
  deadlineAt: Date;
  mode: PlanMode;
  plannerId: string | null;
  status: CycleStatus;
};

export type ReminderDate = { id: string; startsAt: Date; status: DateStatus };

export type Reminder = {
  userId: string;
  type: NotificationType;
  /** Together with type + dueAt the idempotency key. Includes the date's start, so a moved date reminds again. */
  refId: string;
  dueAt: Date;
};

export type ReminderRules = {
  quietHoursStartMinute: number; // e.g. 22:00
  quietHoursEndMinute: number; // e.g. 08:00
};

/** How late a reminder may still go out (e.g. after a missed tick). */
export const MAX_LATENESS_MS = 2 * 3_600_000;

const TURN_HOUR = 9; // "Du bist dran" never before 09:00
const DAY_BEFORE_HOUR = 19; // "Date ist morgen" at 19:00 the day before
const SOON_HOURS = 2; // "Date in 2 Stunden"
const DEADLINE_HOURS = 24; // "Deadline naht" 24 h before

function local(date: Date, zone: string) {
  return DateTime.fromJSDate(date, { zone });
}

/** Moves a time out of the quiet hours to their end (wall-clock, DST-safe). */
export function outOfQuietHours(at: Date, rules: ReminderRules, zone = APP_TIMEZONE): Date {
  const t = local(at, zone);
  const minute = t.hour * 60 + t.minute;
  const { quietHoursStartMinute: start, quietHoursEndMinute: end } = rules;
  const spansMidnight = start > end;
  const quiet = spansMidnight ? minute >= start || minute < end : minute >= start && minute < end;
  if (!quiet) return at;
  const endDay = spansMidnight && minute >= start ? t.plus({ days: 1 }) : t;
  return endDay.set({ hour: Math.floor(end / 60), minute: end % 60, second: 0, millisecond: 0 }).toJSDate();
}

/** All reminders for a round and its date – whether due or not. */
export function plannedReminders(params: {
  cycle: ReminderCycle | null;
  date: ReminderDate | null;
  userIds: [string, string];
  rules: ReminderRules;
  zone?: string;
}): Reminder[] {
  const { cycle, date, userIds, rules, zone = APP_TIMEZONE } = params;
  const reminders: Reminder[] = [];

  if (cycle && cycle.status === "open") {
    const recipients = cycle.mode === "alternating" && cycle.plannerId ? [cycle.plannerId] : userIds;
    const startLocal = local(cycle.startsAt, zone);
    const turnAt = DateTime.max(startLocal, startLocal.set({ hour: TURN_HOUR, minute: 0, second: 0, millisecond: 0 })).toJSDate();
    const deadlineAt = new Date(cycle.deadlineAt.getTime() - DEADLINE_HOURS * 3_600_000);
    for (const userId of recipients) {
      reminders.push({ userId, type: "turn_started", refId: cycle.id, dueAt: outOfQuietHours(turnAt, rules, zone) });
      // Only if the deadline reminder comes after the turn reminder – otherwise one is enough.
      const due = outOfQuietHours(deadlineAt, rules, zone);
      if (due > turnAt && due < cycle.deadlineAt) {
        reminders.push({ userId, type: "deadline_soon", refId: cycle.id, dueAt: due });
      }
    }
  }

  if (date && (date.status === "planned" || date.status === "confirmed")) {
    const ref = `${date.id}@${date.startsAt.toISOString()}`;
    const dayBefore = local(date.startsAt, zone)
      .minus({ days: 1 })
      .set({ hour: DAY_BEFORE_HOUR, minute: 0, second: 0, millisecond: 0 })
      .toJSDate();
    const soon = new Date(date.startsAt.getTime() - SOON_HOURS * 3_600_000);
    for (const userId of userIds) {
      reminders.push({ userId, type: "date_tomorrow", refId: ref, dueAt: dayBefore });
      // Quiet hours do not apply here – a date at 9:00 is reminded at 7:00.
      reminders.push({ userId, type: "date_soon", refId: ref, dueAt: soon });
    }
  }
  return reminders;
}

/**
 * The reminders that should go out now: due, not too late, and still
 * meaningful (nothing about a date that already started).
 */
export function dueReminders(params: Parameters<typeof plannedReminders>[0] & { now: Date }): Reminder[] {
  const { now, date } = params;
  return plannedReminders(params).filter((r) => {
    if (r.dueAt > now || now.getTime() - r.dueAt.getTime() > MAX_LATENESS_MS) return false;
    if ((r.type === "date_tomorrow" || r.type === "date_soon") && date && date.startsAt <= now) return false;
    return true;
  });
}
