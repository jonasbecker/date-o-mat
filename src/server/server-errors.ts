// Server errors nobody would notice otherwise: counted in app_status, the last one shown under
// Einstellungen → Status, and a push (type "errors", off by default) at most once a day.
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { appStatus, notificationPrefs } from "@/server/db/schema";
import { sendToUser } from "@/server/push";

export const ERRORS_KEY = "errors";
const ALERT_EVERY_MS = 24 * 60 * 60_000;

export type ServerErrors = { count: number; lastAt: string; lastMessage: string; lastPath: string | null; alertedAt: string | null };

export async function lastServerErrors(): Promise<ServerErrors | null> {
  const [row] = await db.select().from(appStatus).where(eq(appStatus.key, ERRORS_KEY)).limit(1);
  return row ? (row.value as ServerErrors) : null;
}

/** Never throws: it runs while handling another error. */
export async function recordServerError({ message, path }: { message: string; path: string | null }, now = new Date()): Promise<void> {
  try {
    const before = await lastServerErrors();
    const alert = !before?.alertedAt || now.getTime() - new Date(before.alertedAt).getTime() > ALERT_EVERY_MS;
    const value: ServerErrors = {
      count: (before?.count ?? 0) + 1,
      lastAt: now.toISOString(),
      lastMessage: message.slice(0, 300),
      lastPath: path,
      alertedAt: alert ? now.toISOString() : (before?.alertedAt ?? null),
    };
    await db.insert(appStatus).values({ key: ERRORS_KEY, value, updatedAt: now }).onConflictDoUpdate({ target: appStatus.key, set: { value, updatedAt: now } });
    if (!alert) return;
    const wanting = await db.select({ userId: notificationPrefs.userId }).from(notificationPrefs).where(and(eq(notificationPrefs.type, "errors"), eq(notificationPrefs.enabled, true)));
    for (const { userId } of wanting) {
      await sendToUser(userId, { title: "Zweisamen hatte einen Fehler 🐛", body: `${path ?? "Server"}: ${value.lastMessage}`.slice(0, 180), url: "/settings?t=status", tag: "server-error" }, "errors");
    }
  } catch (error) {
    console.warn("[errors] recording failed", error instanceof Error ? error.message : error);
  }
}
