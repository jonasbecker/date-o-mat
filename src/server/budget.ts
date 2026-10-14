// Monthly budget and savings pot: sums for the UI, closing months in the tick.
import "server-only";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  addMonths,
  budgetLevel,
  closeMonth,
  monthKey,
  monthLabel,
  monthRange,
  monthsBetween,
  monthSpending,
  recapText,
  type BudgetDate,
  type BudgetLevel,
  type MonthSpending,
} from "@/core/budget";
import { APP_TIMEZONE } from "@/lib/domain";
import { db } from "@/server/db";
import { budgetMonths, coupleSettings, datePlans, notificationLog, users, type DatePlan } from "@/server/db/schema";
import { sendToUser } from "@/server/push";
import { getCoupleSettings } from "@/server/settings";

export type BudgetState = {
  month: string;
  label: string;
  budget: number;
  spending: MonthSpending;
  /** Left in this month (budget − spent − planned), can be negative. */
  left: number;
  /** In the savings pot right now (after what this month already took from it). */
  pot: number;
  level: BudgetLevel;
};

async function datesBetween(coupleId: string, start: Date, end: Date): Promise<DatePlan[]> {
  return db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, coupleId), gte(datePlans.startsAt, start), lt(datePlans.startsAt, end)));
}

function asBudgetDates(dates: DatePlan[]): BudgetDate[] {
  return dates.map((d) => ({ startsAt: d.startsAt, status: d.status, estimatedCostEur: d.estimatedCostEur, actualCostEur: d.actualCostEur, fromPot: d.fromPot }));
}

async function lastClosed(coupleId: string) {
  const [row] = await db.select().from(budgetMonths).where(eq(budgetMonths.coupleId, coupleId)).orderBy(desc(budgetMonths.month)).limit(1);
  return row;
}

/** Null when the couple has no budget. */
export async function budgetState(coupleId: string, now: Date): Promise<BudgetState | null> {
  const settings = await getCoupleSettings(coupleId);
  const budget = settings.monthlyBudgetEur;
  if (!budget) return null;
  const month = monthKey(now);
  const { start, end } = monthRange(month);
  const [dates, closed] = await Promise.all([datesBetween(coupleId, start, end), lastClosed(coupleId)]);
  const spending = monthSpending(asBudgetDates(dates), month, now);
  const left = budget - spending.spent - spending.planned;
  // Months not closed yet (the tick catches up) count as closed with the current budget.
  let pot = closed?.potAfterEur ?? 0;
  const from = closed ? addMonths(closed.month, 1) : (settings.budgetSinceMonth ?? month);
  for (const key of monthsBetween(from, addMonths(month, -1))) {
    const range = monthRange(key);
    pot = closeMonth(pot, budget, monthSpending(asBudgetDates(await datesBetween(coupleId, range.start, range.end)), key, range.end));
  }
  return { month, label: monthLabel(month, now), budget, spending, left, pot: Math.max(0, pot - spending.fromPot), level: budgetLevel(left, budget) };
}

export async function setBudget(coupleId: string, budget: number | null, now: Date): Promise<void> {
  const settings = await getCoupleSettings(coupleId);
  await db
    .update(coupleSettings)
    .set({
      monthlyBudgetEur: budget,
      // The pot starts counting from the month the budget was first set.
      budgetSinceMonth: budget ? (settings.budgetSinceMonth ?? monthKey(now)) : settings.budgetSinceMonth,
    })
    .where(eq(coupleSettings.coupleId, coupleId));
}

export async function setActualCost(coupleId: string, dateId: string, cost: number | null): Promise<void> {
  await db
    .update(datePlans)
    .set({ actualCostEur: cost })
    .where(and(eq(datePlans.id, dateId), eq(datePlans.coupleId, coupleId)));
}

/**
 * Tick: closes every finished month since the last closed one (with the
 * current budget) and sends the recap of the latest one – once.
 */
export async function closeBudgetMonths(coupleId: string, now: Date): Promise<void> {
  const settings = await getCoupleSettings(coupleId);
  const budget = settings.monthlyBudgetEur;
  if (!budget || !settings.budgetSinceMonth) return;
  const current = monthKey(now);
  const closed = await lastClosed(coupleId);
  const months = monthsBetween(closed ? addMonths(closed.month, 1) : settings.budgetSinceMonth, addMonths(current, -1));
  if (months.length === 0) return;
  let pot = closed?.potAfterEur ?? 0;
  let last: { month: string; spending: MonthSpending; potBefore: number; potAfter: number } | null = null;
  for (const month of months) {
    const range = monthRange(month);
    const spending = monthSpending(asBudgetDates(await datesBetween(coupleId, range.start, range.end)), month, range.end);
    const potAfter = closeMonth(pot, budget, spending);
    const inserted = await db
      .insert(budgetMonths)
      .values({ coupleId, month, budgetEur: budget, spentEur: spending.spent + spending.planned, fromPotEur: spending.fromPot, dates: spending.count, potAfterEur: potAfter })
      .onConflictDoNothing()
      .returning({ month: budgetMonths.month });
    if (inserted.length === 0) return; // another tick is on it
    last = { month, spending, potBefore: pot, potAfter };
    pot = potAfter;
  }
  // Only the month that just ended is news.
  if (!last || last.month !== addMonths(current, -1)) return;
  const text = recapText({
    month: monthLabel(last.month, now),
    count: last.spending.count,
    total: last.spending.spent + last.spending.planned + last.spending.fromPot,
    budget,
    potDelta: last.potAfter - last.potBefore,
    pot: last.potAfter,
  });
  const members = await db.select({ id: users.id }).from(users).where(eq(users.coupleId, coupleId));
  const dueAt = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).startOf("month").toJSDate();
  for (const member of members) {
    const [claimed] = await db
      .insert(notificationLog)
      .values({ userId: member.id, type: "budget", refId: last.month, dueAt })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (claimed) await sendToUser(member.id, { ...text, url: "/budget", tag: "budget" }, "budget").catch(() => 0);
  }
}

export type BudgetHistoryRow = { month: string; label: string; budget: number; spent: number; fromPot: number; dates: number; potAfter: number };

export async function budgetHistory(coupleId: string, now: Date): Promise<BudgetHistoryRow[]> {
  const rows = await db.select().from(budgetMonths).where(eq(budgetMonths.coupleId, coupleId)).orderBy(desc(budgetMonths.month)).limit(24);
  return rows.map((r) => ({ month: r.month, label: monthLabel(r.month, now), budget: r.budgetEur, spent: r.spentEur, fromPot: r.fromPotEur, dates: r.dates, potAfter: r.potAfterEur }));
}

/** The dates of a month with their costs (budget page). */
export async function monthDates(coupleId: string, month: string): Promise<DatePlan[]> {
  const { start, end } = monthRange(month);
  return (await datesBetween(coupleId, start, end)).filter((d) => d.status !== "cancelled").sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
