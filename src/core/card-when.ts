// The date on a swipe card (SWIPE-KARTE.md §2): a combo card shows its event, every other card the next
// evening (half day for long ideas) when both of them are free – so the card always starts with a day.
// Without calendars it falls back to the next Friday or Saturday evening. Pure.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type IdeaSize } from "@/lib/domain";
import type { Slot } from "./slots";

export type CardWhen = {
  /** "Sa 31.10." */
  day: string;
  /** "20:00 Uhr" / "ab 18:00" */
  time: string;
  /** true: both free · false: someone has something on · null: unknown (no calendars). */
  free: boolean | null;
  /** The line under the day: "✓ ihr habt beide Zeit", "✗ da habt ihr was vor", "kalender fehlt". */
  note: string;
};

/** Small ideas are evening ideas: the first free start at 17:00 or later. */
const EVENING_FROM = 17;

export function dayLabel(date: Date, zone = APP_TIMEZONE): string {
  const d = DateTime.fromJSDate(date, { zone }).setLocale("de");
  return `${d.toFormat("ccc").replace(".", "")} ${d.toFormat("d.M.")}`;
}

function timeLabel(date: Date, zone: string): string {
  return DateTime.fromJSDate(date, { zone }).toFormat("HH:mm");
}

const NOTE = { true: "✓ ihr habt beide Zeit", false: "✗ da habt ihr was vor" } as const;

/** A combo card's event: its day and time, and whether both are free then. */
export function eventWhen(event: { startsAt: Date; allDay: boolean }, free: boolean | null, zone = APP_TIMEZONE): CardWhen {
  return {
    day: dayLabel(event.startsAt, zone),
    time: event.allDay ? "ganztägig" : `${timeLabel(event.startsAt, zone)} Uhr`,
    free,
    note: free === null ? "kalender fehlt" : NOTE[String(free) as "true" | "false"],
  };
}

/** The earliest free slot of the found ones – small ideas only from the evening on. */
export function firstFree(slots: Slot[], size: IdeaSize, zone = APP_TIMEZONE): Slot | null {
  const fitting = size === "small" ? slots.filter((s) => DateTime.fromJSDate(s.start, { zone }).hour >= EVENING_FROM) : slots;
  return [...(fitting.length ? fitting : slots)].sort((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
}

/** No calendars: the next Friday or Saturday evening (today counts until 17:00). */
export function nextWeekendEvening(now: Date, zone = APP_TIMEZONE): Date {
  let day = DateTime.fromJSDate(now, { zone }).startOf("day");
  const late = DateTime.fromJSDate(now, { zone }).hour >= EVENING_FROM;
  for (let i = 0; i < 8; i++) {
    if ((day.weekday === 5 || day.weekday === 6) && !(i === 0 && late)) break;
    day = day.plus({ days: 1 });
  }
  return day.set({ hour: 18 }).toJSDate();
}

/** A card without an event: the next free evening / half day, or a weekend evening without calendars. */
export function freeWhen(slot: Slot | null, now: Date, calendars: boolean, zone = APP_TIMEZONE): CardWhen {
  if (!calendars || !slot) {
    const guess = nextWeekendEvening(now, zone);
    return { day: dayLabel(guess, zone), time: "ab 18:00", free: null, note: calendars ? "gerade nichts frei" : "kalender fehlt" };
  }
  return { day: dayLabel(slot.start, zone), time: `ab ${timeLabel(slot.start, zone)}`, free: true, note: NOTE.true };
}
