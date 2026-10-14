// The round logic depends on the weekday (deadline passed? free slots left this
// week?). Suites that check those pin the couple's dev clock to Tuesday 10:00
// of the current week, so they pass on any day the CI happens to run.
import { DateTime } from "luxon";

export function tuesdayMorningOffset(now = DateTime.now().setZone("Europe/Berlin")) {
  const target = now.startOf("week").plus({ days: 1, hours: 10 });
  return Math.round(target.diff(now, "minutes").minutes);
}
