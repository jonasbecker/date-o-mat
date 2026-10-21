// Operational facts for "Läuft alles?": when the cron tick last ran, and a
// snapshot of everything a person might have to fix.
import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { statusRows, type StatusFacts, type StatusRow } from "@/core/system-status";
import { AI_REQUEST_KINDS, type AiRequestKind } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { AI_LIMITS, aiRequestsToday } from "@/server/anthropic";
import { calendarStates } from "@/server/availability";
import { db } from "@/server/db";
import { appStatus, eventSources, pushSubscriptions } from "@/server/db/schema";
import { env } from "@/server/env";
import { lastServerErrors } from "@/server/server-errors";

const TICK_KEY = "tick";
type TickValue = { at: string; couples: number; errors: number };

export async function recordTick(result: { couples: number; errors: number }, at: Date): Promise<void> {
  const value: TickValue = { at: at.toISOString(), couples: result.couples, errors: result.errors };
  try {
    await db.insert(appStatus).values({ key: TICK_KEY, value, updatedAt: at }).onConflictDoUpdate({ target: appStatus.key, set: { value, updatedAt: at } });
  } catch (error) {
    console.warn("[status] recording the tick failed", error instanceof Error ? error.message : error);
  }
}

export async function lastTick(): Promise<{ at: Date; errors: number } | null> {
  const [row] = await db.select().from(appStatus).where(eq(appStatus.key, TICK_KEY)).limit(1);
  if (!row) return null;
  const value = row.value as Partial<TickValue>;
  const at = typeof value.at === "string" ? new Date(value.at) : row.updatedAt;
  return { at, errors: typeof value.errors === "number" ? value.errors : 0 };
}

/**
 * The checklist for the settings page. Uses the real clock, not the couple's
 * dev clock: the cron runs in real time.
 */
export async function systemStatus(ctx: CoupleContext, coupleNow: Date): Promise<StatusRow[]> {
  const e = env();
  const people = [ctx.user, ctx.partner];
  const [tick, calendars, devices, sources, used, errors] = await Promise.all([
    lastTick(),
    calendarStates(ctx),
    db
      .select({ userId: pushSubscriptions.userId, n: count() })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, people.map((p) => p.id)))
      .groupBy(pushSubscriptions.userId),
    db.select({ lastStatus: eventSources.lastStatus }).from(eventSources).where(and(eq(eventSources.coupleId, ctx.coupleId))),
    Promise.all(AI_REQUEST_KINDS.map(async (kind) => [kind, e.ai ? await aiRequestsToday(ctx.coupleId, kind, coupleNow) : 0] as const)),
    lastServerErrors(),
  ]);
  const facts: StatusFacts = {
    now: new Date(),
    tick,
    cronConfigured: Boolean(e.cronSecret),
    calendars: calendars.map((c) => ({ name: c.name, me: c.isMe, status: c.state === "connected" ? "ok" : c.state === "reauth" ? "needs_reauth" : "missing" })),
    push: { configured: Boolean(e.vapid), devices: people.map((p) => ({ name: p.name, count: devices.find((d) => d.userId === p.id)?.n ?? 0 })) },
    sources: { count: sources.length, failing: sources.filter((s) => s.lastStatus === "error").length },
    ai: { configured: e.ai, used: Object.fromEntries(used) as Record<AiRequestKind, number>, limits: AI_LIMITS },
    photos: e.photoStorage,
    errors: errors ? { count: errors.count, lastAt: new Date(errors.lastAt), lastMessage: errors.lastMessage, lastPath: errors.lastPath } : null,
  };
  return statusRows(facts);
}
