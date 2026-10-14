// Shared Claude client and usage log (for the daily limit and to see what it costs).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte } from "drizzle-orm";
import { DateTime } from "luxon";
import { APP_TIMEZONE, type AiRequestKind } from "@/lib/domain";
import { db } from "@/server/db";
import { aiRequests } from "@/server/db/schema";

let client: Anthropic | undefined;

/** Reads ANTHROPIC_API_KEY (and ANTHROPIC_BASE_URL in tests) from the environment. */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2, timeout: 90_000 });
  return client;
}

export async function recordAiUsage(entry: {
  coupleId: string;
  userId?: string | null;
  kind: AiRequestKind;
  model: string;
  usage?: { input_tokens: number; output_tokens: number } | null;
}): Promise<void> {
  try {
    await db.insert(aiRequests).values({
      coupleId: entry.coupleId,
      userId: entry.userId ?? null,
      kind: entry.kind,
      model: entry.model,
      inputTokens: entry.usage?.input_tokens ?? 0,
      outputTokens: entry.usage?.output_tokens ?? 0,
    });
  } catch (error) {
    console.warn("[ai] usage log failed", error instanceof Error ? error.message : error);
  }
}

/** Requests of this kind since midnight (Berlin). */
export async function aiRequestsToday(coupleId: string, kind: AiRequestKind, now: Date): Promise<number> {
  const midnight = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).startOf("day").toJSDate();
  return db.$count(aiRequests, and(eq(aiRequests.coupleId, coupleId), eq(aiRequests.kind, kind), gte(aiRequests.createdAt, midnight)));
}
