// Anniversary, birthdays and other special days of a couple.
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { dueSpecialReminders, reminderText, upcomingSpecialDays, type SpecialDayInput, type UpcomingDay } from "@/core/special-days";
import type { CoupleContext } from "@/server/auth/dal";
import { budgetState } from "@/server/budget";
import { db } from "@/server/db";
import { notificationLog, specialDays, users, type SpecialDay } from "@/server/db/schema";
import { sendToUser } from "@/server/push";
import { getCoupleSettings } from "@/server/settings";

export const MAX_SPECIAL_DAYS = 20;

export async function listSpecialDays(coupleId: string): Promise<SpecialDay[]> {
  return db.select().from(specialDays).where(eq(specialDays.coupleId, coupleId)).orderBy(asc(specialDays.month), asc(specialDays.day));
}

export async function addSpecialDay(ctx: CoupleContext, input: SpecialDayInput): Promise<boolean> {
  if ((await db.$count(specialDays, eq(specialDays.coupleId, ctx.coupleId))) >= MAX_SPECIAL_DAYS) return false;
  if (input.personId && ![ctx.user.id, ctx.partner.id].includes(input.personId)) return false;
  await db.insert(specialDays).values({ ...input, coupleId: ctx.coupleId, createdById: ctx.user.id });
  return true;
}

export async function deleteSpecialDay(coupleId: string, id: string): Promise<void> {
  await db.delete(specialDays).where(and(eq(specialDays.id, id), eq(specialDays.coupleId, coupleId)));
}

async function namesOf(coupleId: string): Promise<{ names: Record<string, string>; ids: string[] }> {
  const members = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.coupleId, coupleId));
  return { names: Object.fromEntries(members.map((m) => [m.id, m.name])), ids: members.map((m) => m.id) };
}

export async function upcomingDaysFor(coupleId: string, now: Date, withinDays: number): Promise<UpcomingDay[]> {
  const [rows, { names }] = await Promise.all([listSpecialDays(coupleId), namesOf(coupleId)]);
  return upcomingSpecialDays(rows, now, withinDays, names);
}

/** What this person should see on the home screen: no own birthday (it's the other one's surprise). */
export async function upcomingForHome(ctx: CoupleContext, now: Date, withinDays: number): Promise<UpcomingDay[]> {
  return (await upcomingDaysFor(ctx.coupleId, now, withinDays)).filter((d) => !(d.kind === "birthday" && d.personId === ctx.user.id));
}

/** Tick: "Jahrestag in 2 Wochen" – each reminder once (notification_log). */
export async function sendSpecialDayReminders(coupleId: string, now: Date): Promise<void> {
  const [rows, { names, ids }, settings] = await Promise.all([listSpecialDays(coupleId), namesOf(coupleId), getCoupleSettings(coupleId)]);
  if (rows.length === 0 || ids.length !== 2) return;
  const due = dueSpecialReminders(rows, now, [ids[0], ids[1]], { quietHoursStartMinute: settings.quietHoursStartMinute, quietHoursEndMinute: settings.quietHoursEndMinute });
  if (due.length === 0) return;
  const upcoming = upcomingSpecialDays(rows, now, 15, names);
  const pot = (await budgetState(coupleId, now))?.pot ?? null;
  for (const reminder of due) {
    const day = upcoming.find((d) => reminder.refId.startsWith(`${d.id}@`));
    if (!day) continue;
    const [claimed] = await db
      .insert(notificationLog)
      .values({ userId: reminder.userId, type: "special_day", refId: reminder.refId, dueAt: reminder.dueAt })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (!claimed) continue;
    const text = reminderText(day, reminder.daysBefore, pot);
    await sendToUser(reminder.userId, { ...text, url: "/plan?size=large", tag: `special-${day.id}` }, "special_day").catch(() => 0);
  }
}
