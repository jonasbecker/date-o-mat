// Anniversary, birthdays and other yearly days: when is the next one, who
// gets reminded, and what the cards and prompts say. Pure.

import { DateTime } from "luxon";
import { outOfQuietHours, MAX_LATENESS_MS, type ReminderRules } from "./reminders";
import { APP_TIMEZONE, SPECIAL_DAY_KINDS, type SpecialDayKind } from "@/lib/domain";

export const SPECIAL_EMOJI: Record<SpecialDayKind, string> = { anniversary: "💞", birthday: "🎂", other: "⭐" };
/** Reminders this many days before, at 10:00. */
export const REMIND_DAYS_BEFORE = [14, 2] as const;
const REMIND_HOUR = 10;
/** The home card shows up this many days before. */
export const SHOW_DAYS_BEFORE = 21;

export type SpecialDayRow = {
  id: string;
  kind: SpecialDayKind;
  title: string;
  month: number;
  day: number;
  year: number | null;
  personId: string | null;
};

/** The next time month/day comes round (today included); 29 Feb → 28 Feb in other years. */
export function nextOccurrence(month: number, day: number, now: Date, zone = APP_TIMEZONE): DateTime {
  const today = DateTime.fromJSDate(now, { zone }).startOf("day");
  const inYear = (year: number) => {
    const base = DateTime.fromObject({ year, month, day: 1 }, { zone });
    return base.set({ day: Math.min(day, base.daysInMonth ?? 28) });
  };
  const thisYear = inYear(today.year);
  return thisYear >= today ? thisYear : inYear(today.year + 1);
}

export type UpcomingDay = {
  id: string;
  kind: SpecialDayKind;
  /** "2. Jahrestag", "Sams Geburtstag", "Unser erstes Date" */
  label: string;
  date: Date;
  /** Calendar days from today (0 = today). */
  days: number;
  personId: string | null;
  emoji: string;
};

function nth(n: number): string {
  return `${n}.`;
}

export function dayLabel(row: SpecialDayRow, occurrenceYear: number, names: Record<string, string>): string {
  const count = row.year && occurrenceYear > row.year ? occurrenceYear - row.year : null;
  if (row.kind === "anniversary") return count ? `${nth(count)} Jahrestag` : "Jahrestag";
  if (row.kind === "birthday") {
    const name = row.personId ? names[row.personId] : null;
    const base = name ? `${name.trim()}${/[sßxz]$/i.test(name.trim()) ? "'" : "s"} Geburtstag` : "Geburtstag";
    return count ? `${base} (${count})` : base;
  }
  return row.title;
}

export function upcomingSpecialDays(rows: SpecialDayRow[], now: Date, withinDays: number, names: Record<string, string>, zone = APP_TIMEZONE): UpcomingDay[] {
  const today = DateTime.fromJSDate(now, { zone }).startOf("day");
  return rows
    .map((row) => {
      const next = nextOccurrence(row.month, row.day, now, zone);
      return {
        id: row.id,
        kind: row.kind,
        label: dayLabel(row, next.year, names),
        date: next.toJSDate(),
        days: Math.round(next.diff(today, "days").days),
        personId: row.personId,
        emoji: SPECIAL_EMOJI[row.kind],
      };
    })
    .filter((d) => d.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}

/** "heute", "morgen", "in 12 Tagen" */
export function inDaysLabel(days: number): string {
  return days === 0 ? "heute" : days === 1 ? "morgen" : `in ${days} Tagen`;
}

/** A birthday is a surprise job for the other one; everything else is for both. */
export function recipientsFor(row: Pick<SpecialDayRow, "kind" | "personId">, userIds: [string, string]): string[] {
  return row.kind === "birthday" && row.personId ? userIds.filter((id) => id !== row.personId) : [...userIds];
}

export type SpecialReminder = { userId: string; refId: string; dueAt: Date; daysBefore: number };

/** Reminders that are due right now (each once per occurrence: refId = id@date@days). */
export function dueSpecialReminders(rows: SpecialDayRow[], now: Date, userIds: [string, string], rules: ReminderRules, zone = APP_TIMEZONE): SpecialReminder[] {
  const result: SpecialReminder[] = [];
  for (const row of rows) {
    const next = nextOccurrence(row.month, row.day, now, zone);
    for (const daysBefore of REMIND_DAYS_BEFORE) {
      const at = outOfQuietHours(next.minus({ days: daysBefore }).set({ hour: REMIND_HOUR }).toJSDate(), rules, zone);
      if (at > now || now.getTime() - at.getTime() > MAX_LATENESS_MS) continue;
      for (const userId of recipientsFor(row, userIds)) {
        result.push({ userId, refId: `${row.id}@${next.toISODate()}@${daysBefore}`, dueAt: at, daysBefore });
      }
    }
  }
  return result;
}

export function reminderText(day: UpcomingDay, daysBefore: number, pot: number | null): { title: string; body: string } {
  const when = daysBefore === 2 ? "übermorgen" : `in ${daysBefore === 14 ? "2 Wochen" : `${daysBefore} Tagen`}`;
  const potText = pot && pot > 0 ? ` Im Spartopf: ${pot} € 🎁` : "";
  if (day.kind === "birthday") {
    return { title: `${day.label} ist ${when} ${day.emoji}`, body: `Zeit für eine Überraschung – plan was Schönes.${potText}` };
  }
  return { title: `${day.label} ist ${when} ${day.emoji}`, body: `Wie wär's mit einem großen Date?${potText}` };
}

/** For the swipe deck prompt: a few special ideas when a day is near. */
export function specialDayPrompt(days: UpcomingDay[]): string | null {
  const near = days.filter((d) => d.days <= 30);
  if (near.length === 0) return null;
  const what = near.map((d) => `${d.kind === "anniversary" ? "their anniversary" : d.kind === "birthday" ? "a birthday of one of them" : `"${d.label}"`} in ${d.days} days`).join(", ");
  return `Coming up: ${what}. Include 3 special, bigger ideas that would make that day memorable.`;
}

export type SpecialDayInput = { kind: SpecialDayKind; title: string; month: number; day: number; year: number; personId: string | null };

/** The settings form: kind ("anniversary", "birthday:<userId>", "other"), title (for "other"), date (YYYY-MM-DD). */
export function parseSpecialDay(raw: { kind: unknown; title: unknown; date: unknown }, userIds: string[]): SpecialDayInput | { error: string } {
  const kindRaw = typeof raw.kind === "string" ? raw.kind : "";
  const [kind, person] = kindRaw.split(":");
  if (!(SPECIAL_DAY_KINDS as readonly string[]).includes(kind)) return { error: "Bitte eine Art auswählen." };
  if (kind === "birthday" && (!person || !userIds.includes(person))) return { error: "Bitte auswählen, wessen Geburtstag es ist." };
  const date = typeof raw.date === "string" ? DateTime.fromISO(raw.date) : null;
  if (!date || !date.isValid || date.year < 1900 || date.year > 2100) return { error: "Bitte ein Datum auswählen." };
  const title = typeof raw.title === "string" ? raw.title.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (kind === "other" && !title) return { error: "Wie heißt der Tag? (z. B. „Unser erstes Date“)" };
  return {
    kind: kind as SpecialDayKind,
    title: kind === "anniversary" ? "Jahrestag" : kind === "birthday" ? "Geburtstag" : title,
    month: date.month,
    day: date.day,
    year: date.year,
    personId: kind === "birthday" ? person : null,
  };
}
