// Monthly date budget and the savings pot ("Spartopf"). Pure: dates and
// numbers go in, sums and texts come out.
//
// - A date costs its real amount (entered after the date) or else the estimate
//   taken when it was planned (idea / event price), else nothing.
// - Cancelled dates do not count. A date "aus dem Spartopf" is paid from the pot,
//   not from the month.
// - When a month closes: pot += budget − spent (so an overspent month takes from
//   the pot), then − what was paid from the pot; never below 0.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type DateStatus } from "@/lib/domain";
import { normalizeEuro } from "@/lib/idea-input";

export const MAX_BUDGET_EUR = 10_000;

/** "2026-10" in Berlin. */
export function monthKey(date: Date, zone = APP_TIMEZONE): string {
  return DateTime.fromJSDate(date, { zone }).toFormat("yyyy-LL");
}

export function monthStart(key: string, zone = APP_TIMEZONE): DateTime {
  return DateTime.fromFormat(key, "yyyy-LL", { zone });
}

export function monthRange(key: string, zone = APP_TIMEZONE): { start: Date; end: Date } {
  const start = monthStart(key, zone);
  return { start: start.toJSDate(), end: start.plus({ months: 1 }).toJSDate() };
}

export function addMonths(key: string, n: number): string {
  return monthStart(key).plus({ months: n }).toFormat("yyyy-LL");
}

/** Every month from `from` to `to`, both included (empty if from > to). */
export function monthsBetween(from: string, to: string): string[] {
  const result: string[] = [];
  for (let key = from; key <= to && result.length < 120; key = addMonths(key, 1)) result.push(key);
  return result;
}

/** "Oktober" – with the year when it is not the year of `now`. */
export function monthLabel(key: string, now?: Date, zone = APP_TIMEZONE): string {
  const start = monthStart(key, zone).setLocale("de");
  const sameYear = !now || DateTime.fromJSDate(now, { zone }).year === start.year;
  return start.toFormat(sameYear ? "LLLL" : "LLLL yyyy");
}

export type BudgetDate = {
  startsAt: Date;
  status: DateStatus;
  estimatedCostEur: number | null;
  actualCostEur: number | null;
  fromPot: boolean;
};

export function dateCost(date: Pick<BudgetDate, "estimatedCostEur" | "actualCostEur">): number {
  return date.actualCostEur ?? date.estimatedCostEur ?? 0;
}

export type MonthSpending = {
  /** From the month budget: dates that already happened (or started). */
  spent: number;
  /** From the month budget: dates still ahead. */
  planned: number;
  /** Paid from the pot. */
  fromPot: number;
  /** Dates in the month (not cancelled). */
  count: number;
};

export function monthSpending(dates: BudgetDate[], key: string, now: Date, zone = APP_TIMEZONE): MonthSpending {
  const { start, end } = monthRange(key, zone);
  const result: MonthSpending = { spent: 0, planned: 0, fromPot: 0, count: 0 };
  for (const date of dates) {
    if (date.status === "cancelled" || date.startsAt < start || date.startsAt >= end) continue;
    result.count++;
    const cost = dateCost(date);
    if (date.fromPot) result.fromPot += cost;
    else if (date.startsAt <= now || date.status === "done") result.spent += cost;
    else result.planned += cost;
  }
  return result;
}

/** The pot after a month: what was left (or overspent), minus what the pot paid. */
export function closeMonth(potBefore: number, budget: number, spending: Pick<MonthSpending, "spent" | "planned" | "fromPot">): number {
  return Math.max(0, potBefore + budget - (spending.spent + spending.planned) - spending.fromPot);
}

export type BudgetLevel = "ok" | "tight" | "over";

/** ok: more than 30 % left · tight: something left · over: nothing left. */
export function budgetLevel(left: number, budget: number): BudgetLevel {
  if (left <= 0) return "over";
  return budget > 0 && left / budget > 0.3 ? "ok" : "tight";
}

/** Shown next to an idea when planning: null if it fits (or the cost is unknown). */
export function budgetHint(cost: number | null, left: number): string | null {
  if (cost === null || cost <= 0) return null;
  if (left <= 0) return "Euer Budget für diesen Monat ist schon ausgeschöpft";
  return cost > left ? `Sprengt euer Budget (noch ${left} €)` : null;
}

/** Month recap for the push at the start of the next month. */
export function recapText(params: { month: string; count: number; total: number; budget: number; potDelta: number; pot: number }): { title: string; body: string } {
  const { month, count, total, budget, potDelta, pot } = params;
  const dates = count === 0 ? "keine Dates" : count === 1 ? "1 Date" : `${count} Dates`;
  const within = total <= budget;
  const title = within ? `${month}: ${dates}, ${total} € – im Budget 💚` : `${month}: ${dates}, ${total} € – ${total - budget} € drüber`;
  const potText =
    potDelta > 0 ? `${potDelta} € wandern in den Spartopf (jetzt ${pot} €) 🎁` : potDelta < 0 ? `Der Spartopf gleicht aus – jetzt ${pot} €.` : `Spartopf: ${pot} €.`;
  return { title, body: count === 0 ? `Zeit für ein Date? ${potText}` : potText };
}

/**
 * Event prices are per person ("12 €", "ab 9,50 €", "Eintritt frei"): a rough
 * total for two, or null if there is no number.
 */
export function parsePriceEur(text: string | null | undefined): number | null {
  if (!text) return null;
  if (/frei|kostenlos|gratis|free/i.test(text) && !/\d/.test(text)) return 0;
  const match = /(\d{1,4})(?:[.,](\d{1,2}))?\s*(?:€|eur|euro)/i.exec(text) ?? /(?:€|eur)\s*(\d{1,4})(?:[.,](\d{1,2}))?/i.exec(text);
  if (!match) return null;
  const perPerson = Number(match[1]) + (match[2] ? Number(match[2].padEnd(2, "0")) / 100 : 0);
  return Math.round(perPerson * 2);
}

/** The settings field: "80", "80 €", "" (= no budget). Null = no budget, NaN = invalid. */
export function parseBudget(input: string): number | null {
  const cleaned = normalizeEuro(input);
  if (!cleaned) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return Number.NaN;
  const value = Math.round(Number(cleaned));
  return value > 0 && value <= MAX_BUDGET_EUR ? value : Number.NaN;
}
