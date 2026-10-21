// Errors nobody would notice otherwise – on the server (instrumentation.ts) and in the app on a phone
// (components/error-reporter.tsx): counted in app_status, the last one shown under Einstellungen → Status,
// and a push (type "errors", off by default) at most once a day for each of the two.
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { appStatus, notificationPrefs } from "@/server/db/schema";
import { sendToUser } from "@/server/push";

export const ERRORS_KEY = "errors";
export const CLIENT_ERRORS_KEY = "client_errors";
const ALERT_EVERY_MS = 24 * 60 * 60_000;

export type ErrorKind = "server" | "client";
const KEY: Record<ErrorKind, string> = { server: ERRORS_KEY, client: CLIENT_ERRORS_KEY };

export type ServerErrors = {
  count: number;
  lastAt: string;
  lastMessage: string;
  lastPath: string | null;
  /** Client errors: the phone and browser ("iPhone · Safari"). */
  lastDevice?: string | null;
  alertedAt: string | null;
};

export async function lastErrors(kind: ErrorKind): Promise<ServerErrors | null> {
  const [row] = await db.select().from(appStatus).where(eq(appStatus.key, KEY[kind])).limit(1);
  return row ? (row.value as ServerErrors) : null;
}

export const lastServerErrors = () => lastErrors("server");

/** Never throws: it runs while handling another error. */
export async function recordError(kind: ErrorKind, { message, path, device = null }: { message: string; path: string | null; device?: string | null }, now = new Date()): Promise<void> {
  try {
    const before = await lastErrors(kind);
    const alert = !before?.alertedAt || now.getTime() - new Date(before.alertedAt).getTime() > ALERT_EVERY_MS;
    const value: ServerErrors = {
      count: (before?.count ?? 0) + 1,
      lastAt: now.toISOString(),
      lastMessage: message.slice(0, 300),
      lastPath: path,
      ...(kind === "client" ? { lastDevice: device } : {}),
      alertedAt: alert ? now.toISOString() : (before?.alertedAt ?? null),
    };
    await db.insert(appStatus).values({ key: KEY[kind], value, updatedAt: now }).onConflictDoUpdate({ target: appStatus.key, set: { value, updatedAt: now } });
    if (!alert) return;
    const wanting = await db.select({ userId: notificationPrefs.userId }).from(notificationPrefs).where(and(eq(notificationPrefs.type, "errors"), eq(notificationPrefs.enabled, true)));
    const title = kind === "server" ? "Zweisamen hatte einen Fehler 🐛" : "Zweisamen hatte einen Fehler im Handy 🐛";
    const where = kind === "server" ? (path ?? "Server") : [device, path].filter(Boolean).join(" ") || "App";
    for (const { userId } of wanting) {
      await sendToUser(userId, { title, body: `${where}: ${value.lastMessage}`.slice(0, 180), url: "/settings?t=status", tag: `${kind}-error` }, "errors");
    }
  } catch (error) {
    console.warn("[errors] recording failed", error instanceof Error ? error.message : error);
  }
}

export const recordServerError = (input: { message: string; path: string | null }, now = new Date()) => recordError("server", input, now);
