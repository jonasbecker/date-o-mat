import { DateTime } from "luxon";
import type { Slot, SlotMood } from "@/core/slots";
import { APP_TIMEZONE, type IdeaSize } from "./domain";
import { formatHours } from "./slot-settings";

function inZone(date: Date): DateTime {
  return DateTime.fromJSDate(date, { zone: APP_TIMEZONE }).setLocale("de");
}

/** "Mi, 15. Okt., 16:04" */
export function formatDateTime(date: Date): string {
  return inZone(date).toFormat("ccc, d. LLL, HH:mm");
}

/** "Mittwoch, 15. Oktober" */
export function formatLongDate(date: Date): string {
  return inZone(date).toFormat("cccc, d. LLLL");
}

/** "So, 25. Okt." */
export function formatShortDate(date: Date): string {
  return inZone(date).toFormat("ccc, d. LLL");
}

/** Everything the UI needs to show a slot – formatted on the server. */
export type SlotView = {
  key: string;
  size: IdeaSize;
  weekday: string;
  day: string;
  dateLabel: string;
  timeLabel: string;
  durationLabel: string;
  mood: SlotMood;
  startIso: string;
  endIso: string;
};

export function slotView(slot: Slot): SlotView {
  const start = inZone(slot.start);
  const end = inZone(slot.end);
  return {
    key: `${slot.size}-${slot.start.toISOString()}`,
    size: slot.size,
    weekday: start.toFormat("ccc").replace(".", ""),
    day: start.toFormat("d"),
    dateLabel: start.toFormat("cccc, d. LLLL"),
    timeLabel: `${start.toFormat("HH:mm")} – ${end.toFormat("HH:mm")}`,
    durationLabel: formatHours((slot.end.getTime() - slot.start.getTime()) / 60_000),
    mood: slot.mood,
    startIso: slot.start.toISOString(),
    endIso: slot.end.toISOString(),
  };
}

/** Round dates: "12.–18. Okt" or "26. Okt – 1. Nov" (end is exclusive). */
export function formatCycleRange(start: Date, end: Date): string {
  const from = inZone(start);
  const to = inZone(new Date(end.getTime() - 1));
  if (from.month === to.month) return `${from.toFormat("d.")}–${to.toFormat("d. LLL")}`;
  return `${from.toFormat("d. LLL")} – ${to.toFormat("d. LLL")}`;
}

/** "Do, 15. Okt · 20:00" */
export function formatDeadline(date: Date): string {
  return inZone(date).toFormat("ccc, d. LLL · HH:mm");
}

/** "Do 20 Uhr" – a deadline within the week, short enough for one line. */
export function shortDeadline(date: Date): string {
  const d = inZone(date);
  return `${d.toFormat("ccc").replace(".", "")} ${d.minute === 0 ? d.toFormat("H") : d.toFormat("H:mm")} Uhr`;
}

/** "noch 2 Tage", "noch 5 Std.", "noch < 1 Std.", "vorbei" */
export function timeLeftLabel(now: Date, until: Date): string {
  const hours = (until.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return "vorbei";
  if (hours < 1) return "noch < 1 Std.";
  if (hours < 24) return `noch ${Math.floor(hours)} Std.`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "noch 1 Tag" : `noch ${days} Tage`;
}

/** "18:30 – 20:30" */
export function formatTimeRange(start: Date, end: Date): string {
  return `${inZone(start).toFormat("HH:mm")} – ${inZone(end).toFormat("HH:mm")}`;
}

/** "Heute", "Morgen" or "Sa, 18. Okt." – headings of the event list. */
export function dayHeading(date: Date, now: Date): string {
  const day = inZone(date).startOf("day");
  const today = inZone(now).startOf("day");
  const diff = Math.round(day.diff(today, "days").days);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  return day.toFormat("cccc, d. LLL");
}

/** "20:00" */
export function formatClock(date: Date): string {
  return inZone(date).toFormat("HH:mm");
}

/** "gerade eben", "vor 3 Std.", "vor 2 Tagen" */
export function agoLabel(now: Date, then: Date): string {
  const minutes = (now.getTime() - then.getTime()) / 60_000;
  if (minutes < 2) return "gerade eben";
  if (minutes < 60) return `vor ${Math.floor(minutes)} Min.`;
  if (minutes < 48 * 60) return `vor ${Math.floor(minutes / 60)} Std.`;
  return `vor ${Math.floor(minutes / 1440)} Tagen`;
}

/** "heute", "morgen", "übermorgen", "in 5 Tagen" (calendar days, Berlin). */
export function daysUntilLabel(now: Date, date: Date): string {
  const diff = Math.round(inZone(date).startOf("day").diff(inZone(now).startOf("day"), "days").days);
  if (diff <= 0) return "heute";
  if (diff === 1) return "morgen";
  if (diff === 2) return "übermorgen";
  return `in ${diff} Tagen`;
}

/** German genitive of a first name: "Sams", but "Jonas'" / "Max'". */
export function genitive(name: string): string {
  return /[sßxz]$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}s`;
}
