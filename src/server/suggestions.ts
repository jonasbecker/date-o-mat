// Suggestion mode: one pending proposal per round, shared by both partners.
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { pickSuggestion } from "@/core/suggestion";
import type { CoupleContext } from "@/server/auth/dal";
import { searchSlots, type PersonCalendar } from "@/server/availability";
import { db } from "@/server/db";
import { ideas, suggestions, type Cycle, type SuggestionRow } from "@/server/db/schema";
import { ideaCandidates } from "@/server/idea-sources";
import { getCoupleSettings } from "@/server/settings";

export type SuggestionIdea = { id: string; title: string; note: string | null; location: string | null; costEur: number | null };

export type CurrentSuggestion =
  | { status: "ok"; suggestion: SuggestionRow; idea: SuggestionIdea | null }
  | { status: "no_slots" }
  | { status: "not_connected"; people: PersonCalendar[] }
  | { status: "google_error" };

/** Search window for a round: until its end, but at most the search horizon. */
export function searchUntil(cycle: Cycle, now: Date, horizonDays: number): Date {
  return new Date(Math.min(cycle.endsAt.getTime(), now.getTime() + horizonDays * 86_400_000));
}

async function loadIdea(ideaId: string | null): Promise<SuggestionIdea | null> {
  if (!ideaId) return null;
  const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
  return idea ? { id: idea.id, title: idea.title, note: idea.note, location: idea.location, costEur: idea.costEur } : null;
}

/**
 * Returns the pending suggestion of the round, or creates one from live
 * free/busy data. A suggestion whose time has come too close is replaced.
 */
export async function currentSuggestion(ctx: CoupleContext, cycle: Cycle, now: Date): Promise<CurrentSuggestion> {
  const settings = await getCoupleSettings(ctx.coupleId);
  const minStart = now.getTime() + settings.minLeadHours * 3_600_000;

  const all = await db.select().from(suggestions).where(eq(suggestions.cycleId, cycle.id)).orderBy(desc(suggestions.createdAt));
  const pending = all.find((s) => s.status === "pending");
  if (pending && pending.startsAt.getTime() >= minStart) {
    return { status: "ok", suggestion: pending, idea: await loadIdea(pending.ideaId) };
  }
  if (pending) {
    // Too close by now – retire it so it is not offered again.
    await db.update(suggestions).set({ status: "rejected", decidedAt: now }).where(eq(suggestions.id, pending.id));
  }

  const search = await searchSlots(ctx, now, searchUntil(cycle, now, settings.horizonDays));
  if (search.status !== "ok") return search;

  const candidates = await ideaCandidates({ coupleId: ctx.coupleId });
  const pick = pickSuggestion({
    small: search.small,
    large: search.large,
    outdoor: search.outdoor,
    outdoorDark: search.outdoorDark,
    preferLarge: cycle.seq % 2 === 0,
    ideas: candidates.map((c) => ({ ideaId: c.ideaId, title: c.title, size: c.size, addedAt: c.addedAt, note: c.note, setting: c.setting })),
    rejected: all.filter((s) => s.status === "rejected").map((s) => ({ startsAt: s.startsAt, size: s.size, ideaId: s.ideaId })),
  });
  if (!pick) return { status: "no_slots" };

  const [created] = await db
    .insert(suggestions)
    .values({
      cycleId: cycle.id,
      size: pick.slot.size,
      startsAt: pick.slot.start,
      endsAt: pick.slot.end,
      ideaId: pick.idea?.ideaId ?? null,
    })
    .returning();
  return { status: "ok", suggestion: created, idea: await loadIdea(created.ideaId) };
}

/** `cycleId` must be the caller's current round – that scopes the update to the couple. */
export async function rejectSuggestion(cycleId: string, suggestionId: string, userId: string, now: Date): Promise<void> {
  await db
    .update(suggestions)
    .set({ status: "rejected", decidedById: userId, decidedAt: now })
    .where(and(eq(suggestions.id, suggestionId), eq(suggestions.cycleId, cycleId), eq(suggestions.status, "pending")));
}
