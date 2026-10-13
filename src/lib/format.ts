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
