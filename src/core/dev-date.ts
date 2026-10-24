// When the dev tools' test date takes place (server/dev-date.ts).
import { DateTime } from "luxon";
import { APP_TIMEZONE } from "@/lib/domain";

const HOUR = 3_600_000;

/**
 * The next evening at 19:00 at least two hours away – inside the round (a date after its end would belong to the
 * next round), else in two hours, on the hour.
 */
export function devDateStart(now: Date, roundEnd: Date): Date {
  const today = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
  const evening = (today.toMillis() - now.getTime() >= 2 * HOUR ? today : today.plus({ days: 1 })).toJSDate();
  if (evening.getTime() + 2 * HOUR <= roundEnd.getTime()) return evening;
  return DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).plus({ hours: 2 }).endOf("hour").plus({ milliseconds: 1 }).toJSDate();
}
