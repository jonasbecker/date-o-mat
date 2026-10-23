// The Archiv's data (core/archive.ts): the dates that happened with their reviews, photos and banner, and the rounds
// that fell through (their called-off date, if there was one) – read in a few queries for the stem, the grid and a
// leaf's page.
import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { archiveLeaves, type ArchiveDateIn, type ArchiveWiltIn, type Leaf } from "@/core/archive";
import { isMotif, suggestMotif } from "@/core/banners";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cycles, datePhotos, datePlans, dateReviews, ideas, type Cycle, type DatePlan } from "@/server/db/schema";
import { createIdea } from "@/server/ideas";
import type { WiltReason } from "@/lib/domain";

export type ArchiveData = { leaves: Leaf[]; dates: Map<string, ArchiveDateIn & { ideaId: string | null; date: DatePlan }>; wilts: Map<string, WiltRound> };
export type WiltRound = ArchiveWiltIn & { cycle: Cycle; date: DatePlan | null };

/**
 * The whole stem – or, with `focus` (a leaf's page), the order of all leaves (for its Nº) but reviews, photos and the
 * idea's banner only for that one date: a leaf's page does not read every review and photo of the archive.
 */
export async function archiveData(ctx: CoupleContext, focus?: string): Promise<ArchiveData> {
  const [done, skipped] = await Promise.all([
    db
      .select()
      .from(datePlans)
      .where(and(eq(datePlans.coupleId, ctx.coupleId), eq(datePlans.status, "done")))
      .orderBy(desc(datePlans.startsAt)),
    db
      .select()
      .from(cycles)
      .where(and(eq(cycles.coupleId, ctx.coupleId), eq(cycles.status, "skipped"), isNull(cycles.leafRemovedAt)))
      .orderBy(desc(cycles.startsAt)),
  ]);
  const detailed = focus ? done.filter((d) => d.id === focus) : done;
  const dateIds = detailed.map((d) => d.id);
  const ideaIds = detailed.flatMap((d) => (d.ideaId ? [d.ideaId] : []));
  const [reviews, photos, motifs, called] = await Promise.all([
    dateIds.length ? db.select().from(dateReviews).where(inArray(dateReviews.dateId, dateIds)) : [],
    dateIds.length
      ? db.select({ id: datePhotos.id, dateId: datePhotos.dateId }).from(datePhotos).where(inArray(datePhotos.dateId, dateIds)).orderBy(asc(datePhotos.createdAt))
      : [],
    ideaIds.length ? db.select({ id: ideas.id, motif: ideas.motif, title: ideas.title, note: ideas.note }).from(ideas).where(inArray(ideas.id, ideaIds)) : [],
    skipped.length
      ? db
          .select()
          .from(datePlans)
          .where(and(inArray(datePlans.cycleId, skipped.map((c) => c.id)), eq(datePlans.status, "cancelled")))
          .orderBy(desc(datePlans.startsAt))
      : [],
  ]);
  const dates = new Map(
    done.map((d) => {
      const idea = motifs.find((m) => m.id === d.ideaId);
      const motif = idea && isMotif(idea.motif) ? idea.motif : suggestMotif(idea ?? { title: d.title, note: d.note });
      return [
        d.id,
        {
          id: d.id,
          title: d.title,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          plannerId: d.organizerId,
          location: d.location,
          costEur: d.actualCostEur ?? d.estimatedCostEur,
          reviews: reviews.filter((r) => r.dateId === d.id),
          photoIds: photos.filter((p) => p.dateId === d.id).map((p) => p.id),
          motif,
          ideaId: d.ideaId,
          date: d,
        },
      ] as const;
    }),
  );
  const wilts = new Map(
    skipped.map((c) => {
      const date = called.find((d) => d.cycleId === c.id) ?? null;
      return [c.id, { id: c.id, startsAt: c.startsAt, plannerId: date?.organizerId ?? c.plannerId, title: date?.title ?? null, plannedAt: date?.startsAt ?? null, cycle: c, date }] as const;
    }),
  );
  return { leaves: archiveLeaves([...dates.values()], [...wilts.values()], ctx.user.id), dates, wilts };
}

// --- Actions on a leaf ------------------------------------------------------------------------------

/**
 * The idea a date came from, ready to plan again: back on the wishlist if it was taken off, or – a date that never
 * had one (typed in the flow) – a new idea from it.
 */
async function ideaFromDate(ctx: CoupleContext, date: DatePlan): Promise<string> {
  if (date.ideaId) {
    const [idea] = await db
      .update(ideas)
      .set({ archivedAt: null, updatedById: ctx.user.id })
      .where(and(eq(ideas.id, date.ideaId), eq(ideas.coupleId, ctx.coupleId)))
      .returning({ id: ideas.id });
    if (idea) return idea.id;
  }
  const idea = await createIdea(ctx.coupleId, ctx.user.id, {
    title: date.title,
    size: date.size,
    note: date.note,
    url: null,
    costEur: date.estimatedCostEur,
    location: date.location,
    setting: null,
    category: null,
  });
  return idea.id;
}

export async function ideaForDate(ctx: CoupleContext, dateId: string): Promise<string | null> {
  const [date] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.id, dateId), eq(datePlans.coupleId, ctx.coupleId), eq(datePlans.status, "done")))
    .limit(1);
  return date ? ideaFromDate(ctx, date) : null;
}

/** A wilted leaf's idea: the date that was called off in that round (none: the round had no date at all). */
export async function ideaForWilt(ctx: CoupleContext, cycleId: string): Promise<string | null> {
  const [date] = await db
    .select()
    .from(datePlans)
    .where(and(eq(datePlans.cycleId, cycleId), eq(datePlans.coupleId, ctx.coupleId), eq(datePlans.status, "cancelled")))
    .orderBy(desc(datePlans.startsAt))
    .limit(1);
  return date ? ideaFromDate(ctx, date) : null;
}

export async function setWilt(ctx: CoupleContext, cycleId: string, reason: WiltReason | null, note: string | null): Promise<void> {
  await db
    .update(cycles)
    .set({ wiltReason: reason, wiltNote: note })
    .where(and(eq(cycles.id, cycleId), eq(cycles.coupleId, ctx.coupleId), eq(cycles.status, "skipped")));
}

/** Off the stem – the round stays as it was (the plant on the Beet still counts it). */
export async function removeWiltLeaf(ctx: CoupleContext, cycleId: string): Promise<void> {
  await db
    .update(cycles)
    .set({ leafRemovedAt: new Date() })
    .where(and(eq(cycles.id, cycleId), eq(cycles.coupleId, ctx.coupleId), eq(cycles.status, "skipped")));
}
