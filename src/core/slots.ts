// Slot finder: where are both of you free, and which of those times are nice?
// Pure function – busy times come in, ranked slots go out. All wall-clock
// reasoning happens in Europe/Berlin via Luxon, so daylight saving is handled.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type IdeaSize } from "@/lib/domain";
import { mergeRanges, padRanges, subtractRanges, type TimeRange } from "./ranges";

export type SlotRules = {
  smallDurationMinutes: number;
  smallStartFromMinute: number;
  smallStartUntilMinute: number;
  largeMinDurationMinutes: number;
  largeMaxDurationMinutes: number;
  largeStartFromMinute: number;
  largeStartUntilMinute: number;
  latestEndMinute: number;
  minLeadHours: number;
  bufferMinutes: number;
};

/** Why a slot is attractive – mapped to German labels in the UI. */
export type SlotMood =
  | "friday_evening"
  | "evening"
  | "weekend_morning"
  | "weekend_afternoon"
  | "weekend_evening"
  | "weekend_day"
  | "daytime";

export type Slot = {
  start: Date;
  end: Date;
  size: IdeaSize;
  score: number;
  mood: SlotMood;
};

export type FindSlotsInput = {
  now: Date;
  /** Search window end (cycle end or horizon). */
  until: Date;
  /** Busy times of both partners, unmerged and without buffer. */
  busy: TimeRange[];
  rules: SlotRules;
  size: IdeaSize;
  limit?: number;
  zone?: string;
};

const MINUTE = 60_000;
const GRID = 30 * MINUTE;

function atMinuteOfDay(day: DateTime, minuteOfDay: number): DateTime {
  return day.set({ hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60, second: 0, millisecond: 0 });
}

function moodOf(start: DateTime, size: IdeaSize): SlotMood {
  const hour = start.hour + start.minute / 60;
  const weekend = start.weekday >= 6;
  if (size === "large") return weekend ? "weekend_day" : "daytime";
  if (weekend) {
    if (hour < 12) return "weekend_morning";
    if (hour < 18) return "weekend_afternoon";
    return "weekend_evening";
  }
  if (hour >= 17) return start.weekday === 5 ? "friday_evening" : "evening";
  return "daytime";
}

/**
 * Higher is better. Small dates: evenings and weekend afternoons.
 * Large dates: weekends, a relaxed late-morning start, more time.
 * Both: sooner is slightly better (dates far away tend to fall through),
 * and some free time around the slot makes it less stressful.
 */
export function scoreSlot(params: {
  start: DateTime;
  lengthMinutes: number;
  size: IdeaSize;
  rules: SlotRules;
  daysAhead: number;
  slackMinutes: number;
}): number {
  const { start, lengthMinutes, size, rules, daysAhead, slackMinutes } = params;
  const hour = start.hour + start.minute / 60;
  const weekday = start.weekday; // 1 = Monday … 7 = Sunday
  const weekend = weekday >= 6;
  let score = 0;

  if (size === "small") {
    if (weekend) {
      if (hour >= 14 && hour < 18) score += 3;
      else if (hour >= 18 && hour <= 20) score += 3;
      else if (hour >= 10 && hour < 12) score += 2;
      else score += 1;
    } else if (hour >= 18 && hour <= 20) {
      score += weekday === 5 ? 3.5 : 3;
    } else if ((hour >= 17 && hour < 18) || (hour > 20 && hour <= 21)) {
      score += 2;
    } else {
      score += 0.5;
    }
  } else {
    if (weekend) score += 4;
    else if (weekday === 5) score += 1;
    if (hour >= 10 && hour <= 11) score += 1;
    score += (Math.min(lengthMinutes - rules.largeMinDurationMinutes, 240) / 60) * 0.4;
  }

  score -= 0.15 * daysAhead;
  if (slackMinutes >= 60) score += 0.5;
  return Math.round(score * 100) / 100;
}

/**
 * Finds the best slot per day in which both partners are free, then returns
 * the `limit` best days, best first.
 */
export function findSlots(input: FindSlotsInput): Slot[] {
  const { now, until, busy, rules, size, limit = 5, zone = APP_TIMEZONE } = input;
  const earliest = now.getTime() + rules.minLeadHours * 60 * MINUTE;
  const end = until.getTime();
  if (earliest >= end) return [];

  const blocked = mergeRanges(padRanges(busy, rules.bufferMinutes * MINUTE));
  const fromMinute = size === "small" ? rules.smallStartFromMinute : rules.largeStartFromMinute;
  const untilMinute = size === "small" ? rules.smallStartUntilMinute : rules.largeStartUntilMinute;

  const today = DateTime.fromMillis(now.getTime(), { zone }).startOf("day");
  let day = DateTime.fromMillis(earliest, { zone }).startOf("day");
  const lastDay = DateTime.fromMillis(end, { zone }).startOf("day");
  const best: Slot[] = [];

  while (day <= lastDay) {
    const firstStart = atMinuteOfDay(day, fromMinute).toMillis();
    const lastStart = atMinuteOfDay(day, untilMinute).toMillis();
    // A latest end before the window start means "after midnight" (e.g. 01:00).
    const endDay = rules.latestEndMinute <= fromMinute ? day.plus({ days: 1 }) : day;
    const latestEnd = Math.min(atMinuteOfDay(endDay, rules.latestEndMinute).toMillis(), end);
    const free = subtractRanges({ start: Math.max(firstStart, earliest), end: latestEnd }, blocked);
    const daysAhead = Math.round(day.diff(today, "days").days);

    let dayBest: Slot | undefined;
    for (let t = firstStart; t <= lastStart; t += GRID) {
      if (t < earliest) continue;
      const range = free.find((r) => r.start <= t && t < r.end);
      if (!range) continue;

      let length: number;
      if (size === "small") {
        length = rules.smallDurationMinutes * MINUTE;
        if (t + length > range.end) continue;
      } else {
        const available = Math.floor((range.end - t) / GRID) * GRID;
        length = Math.min(rules.largeMaxDurationMinutes * MINUTE, available);
        if (length < rules.largeMinDurationMinutes * MINUTE) continue;
      }

      const start = DateTime.fromMillis(t, { zone });
      const slackMinutes = Math.min(t - range.start, range.end - (t + length)) / MINUTE;
      const score = scoreSlot({ start, lengthMinutes: length / MINUTE, size, rules, daysAhead, slackMinutes });
      if (!dayBest || score > dayBest.score) {
        dayBest = { start: new Date(t), end: new Date(t + length), size, score, mood: moodOf(start, size) };
      }
    }
    if (dayBest) best.push(dayBest);
    day = day.plus({ days: 1 });
  }

  return best.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime()).slice(0, limit);
}
