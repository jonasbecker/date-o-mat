// The periodic job (cron-job.org calls /api/cron/tick every 5 minutes).
// Everything here is idempotent: running it twice, or late, is harmless.
import "server-only";
import { eq, isNotNull } from "drizzle-orm";
import type { CoupleContext } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { getCoupleSettings } from "@/server/settings";
import { currentSuggestion } from "@/server/suggestions";

export type TickResult = { couples: number; errors: number };

export async function tickCouple(coupleId: string): Promise<void> {
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  if (!cycle) return;

  // Suggestion mode: prepare the round's proposal, so it is ready when someone opens the app.
  if (cycle.mode === "suggestion" && cycle.status === "open") {
    const members = await db.select().from(users).where(eq(users.coupleId, coupleId));
    if (members.length === 2) {
      const ctx: CoupleContext = { user: members[0], partner: members[1], coupleId };
      await currentSuggestion(ctx, cycle, now);
    }
  }
}

export async function runTick(): Promise<TickResult> {
  const rows = await db.selectDistinct({ coupleId: users.coupleId }).from(users).where(isNotNull(users.coupleId));
  let errors = 0;
  for (const { coupleId } of rows) {
    try {
      await tickCouple(coupleId!);
    } catch (error) {
      errors++;
      console.error(`[tick] couple ${coupleId} failed`, error);
    }
  }
  return { couples: rows.length, errors };
}
