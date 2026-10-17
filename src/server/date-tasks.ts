// Preparation checklist of a date ("Tisch reservieren"): shared by both,
// with a reminder at 18:00 the day before if something is still open.
import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { MAX_LATENESS_MS } from "@/core/reminders";
import { isSurpriseHidden, prepReminderAt } from "@/core/date-extras";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { datePlans, dateTasks, notificationLog, users, type DateTask } from "@/server/db/schema";
import { upcomingDate } from "@/server/dates";
import { sendToUser } from "@/server/push";

export const MAX_TASKS = 12;

async function ownDate(coupleId: string, dateId: string) {
  const [date] = await db.select().from(datePlans).where(and(eq(datePlans.id, dateId), eq(datePlans.coupleId, coupleId))).limit(1);
  return date;
}

export async function listTasks(dateId: string): Promise<DateTask[]> {
  return db.select().from(dateTasks).where(eq(dateTasks.dateId, dateId)).orderBy(asc(dateTasks.createdAt));
}

export async function addTask(ctx: CoupleContext, dateId: string, title: string): Promise<boolean> {
  const date = await ownDate(ctx.coupleId, dateId);
  const clean = title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!date || !clean || !["planned", "confirmed"].includes(date.status)) return false;
  if ((await db.$count(dateTasks, eq(dateTasks.dateId, dateId))) >= MAX_TASKS) return false;
  await db.insert(dateTasks).values({ dateId, title: clean, createdById: ctx.user.id });
  return true;
}

async function ownTask(coupleId: string, taskId: string) {
  const [row] = await db
    .select({ task: dateTasks })
    .from(dateTasks)
    .innerJoin(datePlans, eq(datePlans.id, dateTasks.dateId))
    .where(and(eq(dateTasks.id, taskId), eq(datePlans.coupleId, coupleId)))
    .limit(1);
  return row?.task;
}

export async function toggleTask(coupleId: string, taskId: string, done: boolean): Promise<void> {
  const task = await ownTask(coupleId, taskId);
  if (task) await db.update(dateTasks).set({ doneAt: done ? new Date() : null }).where(eq(dateTasks.id, task.id));
}

export async function deleteTask(coupleId: string, taskId: string): Promise<void> {
  const task = await ownTask(coupleId, taskId);
  if (task) await db.delete(dateTasks).where(eq(dateTasks.id, task.id));
}

/** Tick: "Noch offen fürs Date morgen: …" at 18:00 the day before – once per date and time. */
export async function sendPrepReminders(coupleId: string, now: Date): Promise<void> {
  const date = await upcomingDate(coupleId, now);
  if (!date) return;
  const at = prepReminderAt(date.startsAt);
  if (at > now || now.getTime() - at.getTime() > MAX_LATENESS_MS || date.startsAt <= now) return;
  const open = await db.select({ title: dateTasks.title }).from(dateTasks).where(and(eq(dateTasks.dateId, date.id), isNull(dateTasks.doneAt)));
  if (open.length === 0) return;
  const members = await db.select({ id: users.id }).from(users).where(eq(users.coupleId, coupleId));
  for (const member of members) {
    // A surprise's to-dos are the organizer's secret.
    if (isSurpriseHidden(date, member.id, now)) continue;
    const [claimed] = await db
      .insert(notificationLog)
      .values({ userId: member.id, type: "prep", refId: `${date.id}@${date.startsAt.toISOString()}`, dueAt: at })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (!claimed) continue;
    const list = open.map((t) => t.title);
    await sendToUser(
      member.id,
      { title: "Noch offen fürs Date morgen 📝", body: list.length > 3 ? `${list.slice(0, 3).join(", ")} und ${list.length - 3} mehr` : list.join(", "), url: `/dates/${date.id}`, tag: "prep" },
      "prep",
    ).catch(() => 0);
  }
}
