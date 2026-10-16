import "server-only";
import { and, desc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import type { IdeaInput } from "@/lib/idea-input";
import { db } from "@/server/db";
import { deckCards, ideas } from "@/server/db/schema";

export type Idea = typeof ideas.$inferSelect;

// Every query is scoped to the couple, so one couple can never touch another's ideas.

export async function listIdeas(coupleId: string): Promise<Idea[]> {
  return db
    .select()
    .from(ideas)
    .where(and(eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt)))
    .orderBy(desc(ideas.createdAt));
}

/** Ideas both swiped right on in the deck (shown with 💞 on the wishlist). */
export async function matchedIdeaIds(coupleId: string): Promise<Set<string>> {
  const rows = await db
    .select({ ideaId: deckCards.ideaId })
    .from(deckCards)
    .where(and(eq(deckCards.coupleId, coupleId), eq(deckCards.status, "matched"), ne(deckCards.kind, "revisit"), isNotNull(deckCards.ideaId)));
  return new Set(rows.map((r) => r.ideaId!));
}

export async function countIdeas(coupleId: string): Promise<number> {
  return db.$count(ideas, and(eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt)));
}

export async function createIdea(coupleId: string, userId: string, input: IdeaInput): Promise<Idea> {
  const [idea] = await db
    .insert(ideas)
    .values({ ...input, coupleId, source: "wishlist", createdById: userId, updatedById: userId })
    .returning();
  return idea;
}

/** Returns false if the idea does not exist (or belongs to another couple). */
export async function updateIdea(coupleId: string, userId: string, ideaId: string, input: IdeaInput): Promise<boolean> {
  const updated = await db
    .update(ideas)
    .set({ ...input, updatedById: userId })
    .where(and(eq(ideas.id, ideaId), eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt)))
    .returning({ id: ideas.id });
  return updated.length > 0;
}

/** Soft delete: planned dates keep their snapshot, the idea just leaves the list. */
export async function archiveIdea(coupleId: string, userId: string, ideaId: string): Promise<boolean> {
  const archived = await db
    .update(ideas)
    .set({ archivedAt: new Date(), updatedById: userId })
    .where(and(eq(ideas.id, ideaId), eq(ideas.coupleId, coupleId), isNull(ideas.archivedAt)))
    .returning({ id: ideas.id });
  return archived.length > 0;
}
