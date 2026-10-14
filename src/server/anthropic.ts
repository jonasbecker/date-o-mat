// Shared Claude client and usage log (for the daily limit and to see what it costs).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { APP_TIMEZONE, type AiRequestKind } from "@/lib/domain";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { aiRequests } from "@/server/db/schema";

let client: Anthropic | undefined;

/** Reads ANTHROPIC_API_KEY from the environment; the base URL is only overridable outside production (tests). */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ baseURL: env().anthropicBaseUrl, maxRetries: 1, timeout: 90_000 });
  return client;
}

/** Claude calls per couple and day (Berlin), per kind. */
export const AI_LIMITS: Record<AiRequestKind, number> = { ideas: 20, events: 40, links: 30 };

/**
 * Books one Claude call before it is made – also if it fails later, so a
 * failing path cannot run unlimited. A per-couple lock makes parallel requests
 * wait, so the limit holds. Returns the booking id, or null when the day's limit is used up.
 */
export async function reserveAiRequest(entry: { coupleId: string; userId?: string | null; kind: AiRequestKind; model: string; now: Date }): Promise<string | null> {
  const midnight = DateTime.fromJSDate(entry.now, { zone: APP_TIMEZONE }).startOf("day").toJSDate();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai:${entry.coupleId}:${entry.kind}`}))`);
    const [{ used }] = await tx
      .select({ used: count() })
      .from(aiRequests)
      .where(and(eq(aiRequests.coupleId, entry.coupleId), eq(aiRequests.kind, entry.kind), gte(aiRequests.createdAt, midnight)));
    if (used >= AI_LIMITS[entry.kind]) return null;
    const [row] = await tx
      .insert(aiRequests)
      .values({ coupleId: entry.coupleId, userId: entry.userId ?? null, kind: entry.kind, model: entry.model })
      .returning({ id: aiRequests.id });
    return row.id;
  });
}

/** Adds the token counts once the call is done. */
export async function recordAiUsage(requestId: string, usage: { input_tokens: number; output_tokens: number } | null | undefined): Promise<void> {
  if (!usage) return;
  try {
    await db.update(aiRequests).set({ inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }).where(eq(aiRequests.id, requestId));
  } catch (error) {
    console.warn("[ai] usage log failed", error instanceof Error ? error.message : error);
  }
}

/** Requests of this kind since midnight (Berlin). */
export async function aiRequestsToday(coupleId: string, kind: AiRequestKind, now: Date): Promise<number> {
  const midnight = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).startOf("day").toJSDate();
  return db.$count(aiRequests, and(eq(aiRequests.coupleId, coupleId), eq(aiRequests.kind, kind), gte(aiRequests.createdAt, midnight)));
}
