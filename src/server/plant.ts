// The couple's plant: every date lived is a leaf, every round that fell through a wilted one.
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cycles, datePlans } from "@/server/db/schema";

export type Round = "done" | "skipped";

/** Oldest first – the bottom leaf is the first date. */
export async function plantRounds(coupleId: string): Promise<Round[]> {
  const [done, skipped] = await Promise.all([
    db.select({ at: datePlans.startsAt }).from(datePlans).where(and(eq(datePlans.coupleId, coupleId), eq(datePlans.status, "done"))),
    db.select({ at: cycles.endsAt }).from(cycles).where(and(eq(cycles.coupleId, coupleId), eq(cycles.status, "skipped"))),
  ]);
  return [...done.map((r) => ({ at: r.at, kind: "done" as const })), ...skipped.map((r) => ({ at: r.at, kind: "skipped" as const }))]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((r) => r.kind);
}

export type SkippedRound = { id: string; startsAt: Date; endsAt: Date; plannerId: string | null };

/** Rounds that fell through – the wilted tiles in the Archiv. Newest first. */
export async function skippedRounds(coupleId: string): Promise<SkippedRound[]> {
  return db
    .select({ id: cycles.id, startsAt: cycles.startsAt, endsAt: cycles.endsAt, plannerId: cycles.plannerId })
    .from(cycles)
    .where(and(eq(cycles.coupleId, coupleId), eq(cycles.status, "skipped")))
    .orderBy(desc(cycles.startsAt));
}
