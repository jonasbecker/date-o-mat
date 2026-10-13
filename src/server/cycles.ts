// Round ("Zyklus") engine: creates rounds, closes finished ones, keeps statuses current.
// Idempotent – safe to run from the cron tick and on every page view.
import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { alignedCycleStart, cycleDeadline, cycleEnd, cycleStatus, plannerForSeq } from "@/core/cycles";
import { db } from "@/server/db";
import { cycles, datePlans, users, type CoupleSettings, type Cycle } from "@/server/db/schema";
import { getCoupleSettings } from "@/server/settings";

/** Safety net: never create more than this many rounds in one go (e.g. after months of silence). */
const MAX_CATCH_UP = 120;

async function members(coupleId: string): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.coupleId, coupleId)).orderBy(asc(users.createdAt));
  return rows.map((r) => r.id);
}

function plannerIds(settings: CoupleSettings, memberIds: string[]): [string, string] {
  const first = settings.firstPlannerId && memberIds.includes(settings.firstPlannerId) ? settings.firstPlannerId : memberIds[0];
  const other = memberIds.find((id) => id !== first)!;
  return [first, other];
}

function buildCycle(coupleId: string, seq: number, start: Date, settings: CoupleSettings, memberIds: string[]) {
  const end = cycleEnd(settings.rhythm, start);
  const [first, other] = plannerIds(settings, memberIds);
  return {
    coupleId,
    seq,
    startsAt: start,
    endsAt: end,
    deadlineAt: cycleDeadline(start, end, settings.deadlineDaysBeforeEnd, settings.deadlineMinute),
    mode: settings.mode,
    plannerId: settings.mode === "alternating" ? plannerForSeq(seq, first, other) : null,
  };
}

async function latestCycle(coupleId: string): Promise<Cycle | undefined> {
  const [cycle] = await db.select().from(cycles).where(eq(cycles.coupleId, coupleId)).orderBy(desc(cycles.seq)).limit(1);
  return cycle;
}

/** The latest non-cancelled date of a round, if any. */
export async function activeDateOf(cycleId: string) {
  const [date] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.cycleId, cycleId), ne(datePlans.status, "cancelled")))
    .orderBy(desc(datePlans.createdAt))
    .limit(1);
  return date;
}

/** Recomputes the status of rounds that are still in motion (open/planned/confirmed). */
async function refreshStatuses(coupleId: string, now: Date): Promise<void> {
  const active = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.coupleId, coupleId), inArray(cycles.status, ["open", "planned", "confirmed"])));
  for (const cycle of active) {
    const date = await activeDateOf(cycle.id);
    const status = cycleStatus({ current: cycle.status, date: date ?? null, cycleEnd: cycle.endsAt, now });
    const closed = cycle.endsAt <= now && !cycle.closedAt;
    if (status !== cycle.status || closed) {
      await db
        .update(cycles)
        .set({ status, ...(closed ? { closedAt: now } : {}) })
        .where(eq(cycles.id, cycle.id));
    }
    if (date && status === "done" && date.status !== "done") {
      await db.update(datePlans).set({ status: "done" }).where(eq(datePlans.id, date.id));
    }
  }
}

/**
 * Makes sure the round containing `now` exists: creates the first round,
 * and after the end of a round the next one (rhythm keeps running, even
 * if a round passed without a date). Returns the current round.
 */
export async function ensureCurrentCycle(coupleId: string, now: Date): Promise<Cycle | null> {
  const memberIds = await members(coupleId);
  if (memberIds.length < 2) return null;
  const settings = await getCoupleSettings(coupleId);

  let latest = await latestCycle(coupleId);
  if (!latest) {
    await db
      .insert(cycles)
      .values(buildCycle(coupleId, 1, alignedCycleStart(settings.rhythm, now), settings, memberIds))
      .onConflictDoNothing();
    latest = await latestCycle(coupleId);
  }

  for (let i = 0; latest && latest.endsAt <= now && i < MAX_CATCH_UP; i++) {
    // Settings can change between rounds (rhythm, mode) – always build from the current ones.
    await db
      .insert(cycles)
      .values(buildCycle(coupleId, latest.seq + 1, latest.endsAt, settings, memberIds))
      .onConflictDoNothing();
    latest = await latestCycle(coupleId);
  }

  await refreshStatuses(coupleId, now);
  return (await latestCycle(coupleId)) ?? null;
}

/** The last rounds, oldest first (for the history dots on the home screen). */
export async function cycleHistory(coupleId: string, limit = 8): Promise<Cycle[]> {
  const rows = await db.select().from(cycles).where(eq(cycles.coupleId, coupleId)).orderBy(desc(cycles.seq)).limit(limit);
  return rows.reverse();
}

/**
 * After the settings changed: a round that is still open follows the new
 * mode and deadline right away. The rhythm applies from the next round.
 */
export async function applySettingsToOpenCycle(coupleId: string, now: Date): Promise<void> {
  const current = await ensureCurrentCycle(coupleId, now);
  if (!current || current.status !== "open") return;
  const settings = await getCoupleSettings(coupleId);
  const [first, other] = plannerIds(settings, await members(coupleId));
  await db
    .update(cycles)
    .set({
      mode: settings.mode,
      plannerId: settings.mode === "alternating" ? plannerForSeq(current.seq, first, other) : null,
      deadlineAt: cycleDeadline(current.startsAt, current.endsAt, settings.deadlineDaysBeforeEnd, settings.deadlineMinute),
    })
    .where(eq(cycles.id, current.id));
}
