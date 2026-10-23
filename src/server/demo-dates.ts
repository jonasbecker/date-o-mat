// Test dates for the Archiv (core/demo-dates.ts): switched on, they are written as past rounds marked `demo` (with a
// negative seq – the real rounds count up from 1); switched off, those rounds are deleted and their dates, reviews,
// checklists and photos go with them (foreign keys cascade). The round logic never sees them (server/cycles.ts).
import "server-only";
import { and, eq } from "drizzle-orm";
import { demoPhotoPath, demoRounds } from "@/core/demo-dates";
import type { CoupleContext } from "@/server/auth/dal";
import { db } from "@/server/db";
import { cycles, datePhotos, datePlans, dateReviews, dateTasks } from "@/server/db/schema";

export async function demoDatesOn(coupleId: string): Promise<boolean> {
  return (await db.$count(cycles, and(eq(cycles.coupleId, coupleId), eq(cycles.demo, true)))) > 0;
}

export async function removeDemoDates(coupleId: string): Promise<void> {
  await db.delete(cycles).where(and(eq(cycles.coupleId, coupleId), eq(cycles.demo, true)));
}

/** Writes the test dates (anew – an earlier set goes first). */
export async function addDemoDates(ctx: CoupleContext, now: Date): Promise<void> {
  const people = [ctx.user, ctx.partner];
  await db.transaction(async (tx) => {
    await tx.delete(cycles).where(and(eq(cycles.coupleId, ctx.coupleId), eq(cycles.demo, true)));
    let seed = 0;
    for (const [i, round] of demoRounds(now).entries()) {
      const [cycle] = await tx
        .insert(cycles)
        .values({
          coupleId: ctx.coupleId,
          seq: -(i + 1),
          startsAt: round.startsAt,
          endsAt: round.endsAt,
          deadlineAt: round.endsAt,
          mode: "alternating",
          plannerId: people[i % 2].id,
          status: round.date ? "done" : "skipped",
          closedAt: round.endsAt,
          demo: true,
        })
        .returning({ id: cycles.id });
      const d = round.date;
      if (!d) continue;
      const organizer = people[d.organizer];
      const other = people[1 - d.organizer];
      const [date] = await tx
        .insert(datePlans)
        .values({
          coupleId: ctx.coupleId,
          cycleId: cycle.id,
          title: d.title,
          size: d.size,
          location: d.location,
          note: d.note,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          organizerId: organizer.id,
          proposedById: organizer.id,
          confirmedById: other.id,
          confirmedAt: d.startsAt,
          status: "done",
          // Never sent to Google: it is not pending.
          syncStatus: "synced",
          estimatedCostEur: d.costEur,
          actualCostEur: d.costEur,
        })
        .returning({ id: datePlans.id });
      if (d.reviews.length) {
        await tx.insert(dateReviews).values(d.reviews.map((r) => ({ dateId: date.id, userId: people[r.who].id, rating: r.rating, note: r.note, again: r.again })));
      }
      if (d.tasks.length) {
        await tx.insert(dateTasks).values(d.tasks.map((t) => ({ dateId: date.id, title: t.title, doneAt: t.done ? d.startsAt : null, createdById: organizer.id })));
      }
      for (let p = 0; p < d.photos; p++, seed++) {
        await tx.insert(datePhotos).values({
          coupleId: ctx.coupleId,
          dateId: date.id,
          uploadedById: people[p % 2].id,
          fullPath: demoPhotoPath(seed),
          thumbPath: demoPhotoPath(seed),
          width: 1200,
          height: 900,
          bytes: 1000,
        });
      }
    }
  });
}

