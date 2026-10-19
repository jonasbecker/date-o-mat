// Sunrise and sunset for Köln, computed (no API): the sunrise equation from the Julian date
// of a Berlin calendar day. Good to about a minute – plenty for "is it still light?".

import { DateTime } from "luxon";
import { APP_TIMEZONE } from "@/lib/domain";

export const COLOGNE = { latitude: 50.94, longitude: 6.96 } as const;

const RAD = Math.PI / 180;
const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5;
const J2000 = 2_451_545;

export type SunTimes = { sunrise: Date; sunset: Date };

function toDate(julian: number): Date {
  return new Date((julian - UNIX_EPOCH_JD) * MS_PER_DAY);
}

/** Sunrise and sunset on the given Berlin calendar day. Null in polar day/night (not a thing in Köln). */
export function sunTimes(day: DateTime, place: { latitude: number; longitude: number } = COLOGNE): SunTimes | null {
  // The calendar date (year, month, day) – not an instant – picks the day.
  const noonUtc = Date.UTC(day.year, day.month - 1, day.day, 12);
  const n = Math.round(noonUtc / MS_PER_DAY + UNIX_EPOCH_JD - J2000);
  const meanSolarNoon = n - place.longitude / 360;
  const anomaly = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const center = 1.9148 * Math.sin(anomaly * RAD) + 0.02 * Math.sin(2 * anomaly * RAD) + 0.0003 * Math.sin(3 * anomaly * RAD);
  const eclipticLongitude = (anomaly + center + 180 + 102.9372) % 360;
  const transit = J2000 + meanSolarNoon + 0.0053 * Math.sin(anomaly * RAD) - 0.0069 * Math.sin(2 * eclipticLongitude * RAD);
  const declination = Math.asin(Math.sin(eclipticLongitude * RAD) * Math.sin(23.4397 * RAD));
  const cosHourAngle = (Math.sin(-0.833 * RAD) - Math.sin(place.latitude * RAD) * Math.sin(declination)) / (Math.cos(place.latitude * RAD) * Math.cos(declination));
  if (cosHourAngle < -1 || cosHourAngle > 1) return null;
  const hourAngle = Math.acos(cosHourAngle) / RAD;
  return { sunrise: toDate(transit - hourAngle / 360), sunset: toDate(transit + hourAngle / 360) };
}

/** Which share (0–1) of the time span lies between sunrise and sunset? Spans across days are summed up. */
export function daylightShare(start: Date, end: Date, zone = APP_TIMEZONE): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 1;
  let light = 0;
  let day = DateTime.fromJSDate(start, { zone }).startOf("day");
  const last = DateTime.fromJSDate(end, { zone }).startOf("day");
  while (day <= last) {
    const sun = sunTimes(day);
    if (sun) {
      const from = Math.max(start.getTime(), sun.sunrise.getTime());
      const to = Math.min(end.getTime(), sun.sunset.getTime());
      if (to > from) light += to - from;
    }
    day = day.plus({ days: 1 });
  }
  return Math.min(1, light / total);
}
