// What the notifications say, and when they go out.
import "server-only";
import { desc, eq } from "drizzle-orm";
import { dueReminders, type Reminder } from "@/core/reminders";
import { formatDeadline, formatShortDate, formatTimeRange, genitive } from "@/lib/format";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cycles, notificationLog, users, type Cycle, type DatePlan } from "@/server/db/schema";
import { coupleNow } from "@/server/clock";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { reviewReminderDates } from "@/server/reviews";
import { sendToUser, type PushPayload } from "@/server/push";
import { getCoupleSettings } from "@/server/settings";

function reminderText(reminder: Reminder, cycle: Cycle | undefined, date: DatePlan | undefined, reviewTitle?: string): PushPayload {
  switch (reminder.type) {
    case "turn_started":
      return cycle?.mode === "suggestion"
        ? { title: "Neue Runde, neuer Vorschlag ✨", body: "Der Date-O-Mat hat eine Idee für euch – schau mal rein.", url: "/", tag: "turn" }
        : {
            title: "Du bist dran! 🎯",
            body: `Plan bis ${cycle ? formatDeadline(cycle.deadlineAt) : "Ende der Runde"} euer nächstes Date.`,
            url: "/plan",
            tag: "turn",
          };
    case "deadline_soon":
      return {
        title: "Noch 24 Stunden ⏰",
        body: `Bis ${cycle ? formatDeadline(cycle.deadlineAt) : "morgen"} ein Date festlegen – freie Zeiten warten schon.`,
        url: "/plan",
        tag: "turn",
      };
    case "date_tomorrow":
      return {
        title: "Morgen ist Date-Tag 💞",
        body: date ? `${date.title} · ${formatTimeRange(date.startsAt, date.endsAt)} Uhr` : "Freut euch!",
        url: "/",
        tag: "date",
      };
    case "date_soon":
      return {
        title: `In 2 Stunden: ${date?.title ?? "euer Date"} 💞`,
        body: date ? `${formatTimeRange(date.startsAt, date.endsAt)} Uhr${date.location ? ` · ${date.location}` : ""}` : "",
        url: "/",
        tag: "date",
      };
    case "review_due":
      return {
        title: "Wie war's? 💭",
        body: `${reviewTitle ?? "Euer Date"} – vergib ein paar Herzen und halt fest, was schön war.`,
        url: `/dates/${reminder.refId}`,
        tag: "review",
      };
    default:
      return { title: "Date-O-Mat", body: "", url: "/" };
  }
}

/**
 * Sends the reminders that are due right now. Each one is first written to
 * notification_log (unique key) – only if that insert succeeds is it sent,
 * so overlapping ticks never send twice.
 */
export async function sendDueReminders(coupleId: string, now: Date): Promise<number> {
  const members = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.coupleId, coupleId));
  if (members.length !== 2) return 0;
  const settings = await getCoupleSettings(coupleId);
  const [cycle] = await db.select().from(cycles).where(eq(cycles.coupleId, coupleId)).orderBy(desc(cycles.seq)).limit(1);
  const date = await upcomingDate(coupleId, now);
  const reviewDates = await reviewReminderDates(coupleId, now);

  const due = dueReminders({
    now,
    cycle: cycle ?? null,
    date: date ?? null,
    reviewDates,
    userIds: [members[0].id, members[1].id],
    rules: { quietHoursStartMinute: settings.quietHoursStartMinute, quietHoursEndMinute: settings.quietHoursEndMinute },
  });

  let sent = 0;
  for (const reminder of due) {
    const [claimed] = await db
      .insert(notificationLog)
      .values({ userId: reminder.userId, type: reminder.type, refId: reminder.refId, dueAt: reminder.dueAt })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (!claimed) continue;
    // A surprise date stays one for the partner ("🎁 Überraschung von …").
    const shown = date ? dateForViewer(date, reminder.userId, members, now) : date;
    sent += await sendToUser(reminder.userId, reminderText(reminder, cycle, shown, reviewDates.find((d) => d.id === reminder.refId)?.title), reminder.type);
  }
  return sent;
}

export type PartnerEvent = "planned" | "rescheduled" | "confirmed" | "cancelled";

/** Tells the partner right away what just happened (sent after the response). */
export async function notifyPartner(ctx: CoupleContext, event: PartnerEvent, fullDate: DatePlan) {
  const name = ctx.user.name;
  const date = dateForViewer(fullDate, ctx.partner.id, [ctx.user, ctx.partner], coupleNow(await getCoupleSettings(ctx.coupleId)));
  const when = `${formatShortDate(date.startsAt)}, ${formatTimeRange(date.startsAt, date.endsAt)}`;
  const payloads: Record<PartnerEvent, PushPayload> = {
    planned: { title: `${name} hat ein Date geplant 🎉`, body: `${date.title} · ${when} – passt dir das?`, url: "/", tag: "date" },
    rescheduled: { title: `${name} schlägt eine neue Zeit vor`, body: `${date.title} · ${when} – passt dir das?`, url: "/", tag: "date" },
    confirmed: { title: `${name} sagt: Passt! 💚`, body: `${date.title} · ${when}`, url: "/", tag: "date" },
    cancelled: { title: `${name} hat das Date abgesagt`, body: `${date.title} findet nicht statt. Die Runde ist wieder offen.`, url: "/", tag: "date" },
  };
  try {
    await sendToUser(ctx.partner.id, payloads[event], "partner_activity");
  } catch (error) {
    console.warn("[push] partner notification failed", error);
  }
}

/** "Jonas hat verraten, wie's war" – nudges the partner to review too (or tells them both are in). */
export async function notifyPartnerReviewed(ctx: CoupleContext, date: Pick<DatePlan, "id" | "title">, partnerDone: boolean) {
  const payload: PushPayload = partnerDone
    ? { title: `${ctx.user.name} hat „${date.title}“ bewertet 💞`, body: "Jetzt seht ihr beide, wie's für den anderen war.", url: `/dates/${date.id}`, tag: "review" }
    : { title: `${ctx.user.name} hat verraten, wie's war`, body: `„${date.title}“ – deine Herzen fehlen noch. Danach siehst du ${genitive(ctx.user.name)}.`, url: `/dates/${date.id}`, tag: "review" };
  try {
    await sendToUser(ctx.partner.id, payload, "partner_activity");
  } catch (error) {
    console.warn("[push] partner notification failed", error);
  }
}
