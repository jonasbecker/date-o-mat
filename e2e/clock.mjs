// The round logic depends on the weekday (deadline passed? free slots left this
// week?). Suites that check those pin the couple's dev clock to Tuesday 10:00
// of the current week, so they pass on any day the CI happens to run.
import { DateTime } from "luxon";

export function tuesdayMorningOffset(now = DateTime.now().setZone("Europe/Berlin")) {
  const target = now.startOf("week").plus({ days: 1, hours: 10 });
  return Math.round(target.diff(now, "minutes").minutes);
}

/**
 * Two evenings (19:00) for event tests, counted from the pinned dev clock (Tuesday of this
 * week), not from the real day: always two different days, 3–8 days ahead (inside the
 * 14-day window of the swipe deck) and never on a Wednesday, Friday or Saturday – the days
 * the Google mock keeps busy.
 */
export function eventEvenings(now = DateTime.now().setZone("Europe/Berlin")) {
  const tuesday = now.startOf("week").plus({ days: 1 });
  const days = [];
  for (let offset = 3; days.length < 2; offset++) {
    const day = tuesday.plus({ days: offset });
    if (![3, 5, 6].includes(day.weekday)) days.push(day.set({ hour: 19 }).toUTC().toISO());
  }
  return days;
}
