// Dev tools (ENABLE_DEV_TOOLS=1 only): put the current round into a date state without planning one together –
// no date, my proposal, the partner's proposal or a date both agreed to. The test date never goes to Google Calendar
// (synced, no event id: the sync and the read-back leave it alone); a real upcoming date is cancelled the normal way.
import "server-only";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { devDateStart } from "@/core/dev-date";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { datePlans, ideas } from "@/server/db/schema";
import { cancelDate } from "@/server/dates";
import { ensureCurrentCycle } from "@/server/cycles";

export const DEV_DATE_STATES = ["none", "mine", "theirs", "confirmed"] as const;
export type DevDateState = (typeof DEV_DATE_STATES)[number];

/** The date state the dev card shows as chosen. */
export async function devDateState(ctx: CoupleContext, now: Date): Promise<DevDateState> {
  const [date] = await db
    .select({ status: datePlans.status, proposedById: datePlans.proposedById })
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, ctx.coupleId), inArray(datePlans.status, ["planned", "confirmed"]), gt(datePlans.endsAt, now)))
    .limit(1);
  if (!date) return "none";
  if (date.status === "confirmed") return "confirmed";
  return date.proposedById === ctx.user.id ? "mine" : "theirs";
}

export type DevDateResult = { ok: true } | { ok: false; error: "no_round" | "round_done" };

export async function setDevDate(ctx: CoupleContext, state: DevDateState, now: Date): Promise<DevDateResult> {
  // Clear what is planned: test dates go, real ones are cancelled (their Google event with them).
  const upcoming = await db
    .select({ id: datePlans.id, googleEventId: datePlans.googleEventId })
    .from(datePlans)
    .where(and(eq(datePlans.coupleId, ctx.coupleId), inArray(datePlans.status, ["planned", "confirmed"]), gt(datePlans.endsAt, now)));
  for (const date of upcoming) {
    if (date.googleEventId) await cancelDate(ctx, date.id, now);
    else await db.delete(datePlans).where(eq(datePlans.id, date.id));
  }
  const round = await ensureCurrentCycle(ctx.coupleId, now);
  if (state === "none") return { ok: true };
  if (!round) return { ok: false, error: "no_round" };
  if (round.status === "done" || round.status === "skipped") return { ok: false, error: "round_done" };

  const [idea] = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.coupleId, ctx.coupleId), isNull(ideas.archivedAt)))
    .limit(1);
  const start = devDateStart(now, round.endsAt);
  const proposer = state === "theirs" ? ctx.partner.id : ctx.user.id;
  await db.insert(datePlans).values({
    coupleId: ctx.coupleId,
    cycleId: round.id,
    ideaId: idea?.id ?? null,
    title: idea?.title ?? "Testdate",
    location: idea?.location ?? null,
    note: idea?.note ?? null,
    url: idea?.url ?? null,
    estimatedCostEur: idea?.costEur ?? null,
    size: "small",
    startsAt: start,
    endsAt: new Date(start.getTime() + 2 * 3_600_000),
    organizerId: proposer,
    proposedById: proposer,
    status: state === "confirmed" ? "confirmed" : "planned",
    confirmedById: state === "confirmed" ? ctx.partner.id : null,
    confirmedAt: state === "confirmed" ? now : null,
    syncStatus: "synced",
  });
  await ensureCurrentCycle(ctx.coupleId, now); // round status → planned / confirmed
  return { ok: true };
}
