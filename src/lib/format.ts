import { DateTime } from "luxon";
import { APP_TIMEZONE } from "./domain";

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
