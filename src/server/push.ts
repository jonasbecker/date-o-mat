// Web Push: subscriptions, preferences and sending.
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/domain";
import { db } from "@/server/db";
import { notificationPrefs, pushSubscriptions } from "@/server/db/schema";
import { env } from "@/server/env";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export type BrowserSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

let configured = false;
function configure(): boolean {
  const vapid = env().vapid;
  if (!vapid) return false;
  if (!configured) {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    configured = true;
  }
  return true;
}

export function pushPublicKey(): string | null {
  return env().vapid?.publicKey ?? null;
}

export async function saveSubscription(userId: string, subscription: BrowserSubscription, userAgent: string | null): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent, failureCount: 0 },
    });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

export async function countSubscriptions(userId: string): Promise<number> {
  return db.$count(pushSubscriptions, eq(pushSubscriptions.userId, userId));
}

/** All notification types with their on/off state (no row = on). */
export async function getPrefs(userId: string): Promise<Record<NotificationType, boolean>> {
  const rows = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId));
  return Object.fromEntries(NOTIFICATION_TYPES.map((type) => [type, rows.find((r) => r.type === type)?.enabled ?? true])) as Record<
    NotificationType,
    boolean
  >;
}

export async function setPref(userId: string, type: NotificationType, enabled: boolean): Promise<void> {
  await db
    .insert(notificationPrefs)
    .values({ userId, type, enabled })
    .onConflictDoUpdate({ target: [notificationPrefs.userId, notificationPrefs.type], set: { enabled } });
}

/**
 * Sends a notification to every device of the user. `type` is checked against
 * the user's preferences ("test" always goes out). Dead subscriptions are removed.
 * Returns how many devices accepted it.
 */
export async function sendToUser(userId: string, payload: PushPayload, type: NotificationType | "test"): Promise<number> {
  if (!configure()) return 0;
  if (type !== "test" && !(await getPrefs(userId))[type]) return 0;

  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let delivered = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 60 * 60, urgency: type === "date_soon" ? "high" : "normal", timeout: 10_000 },
      );
      delivered++;
      await db.update(pushSubscriptions).set({ lastSuccessAt: new Date(), failureCount: 0 }).where(eq(pushSubscriptions.id, sub.id));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410 || sub.failureCount >= 9) {
        // The browser dropped the subscription (app removed, permission revoked …).
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      } else {
        console.warn(`[push] delivery to ${new URL(sub.endpoint).host} failed (${status ?? "network"})`);
        await db
          .update(pushSubscriptions)
          .set({ failureCount: sql`${pushSubscriptions.failureCount} + 1` })
          .where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
  return delivered;
}
