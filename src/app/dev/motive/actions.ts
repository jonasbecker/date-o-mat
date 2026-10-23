"use server";

import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { isMotif, suggestMotif } from "@/core/banners";
import { requireCouple } from "@/server/auth/dal";
import { db } from "@/server/db";
import { ideas } from "@/server/db/schema";

/** One idea's banner, as picked on the check page (null = back to the suggestion). */
export async function setIdeaMotifAction(id: string, motif: string | null): Promise<void> {
  const { coupleId } = await requireCouple();
  const ideaId = z.uuid().safeParse(id);
  if (!ideaId.success || (motif !== null && !isMotif(motif))) return;
  await db.update(ideas).set({ motif }).where(and(eq(ideas.id, ideaId.data), eq(ideas.coupleId, coupleId)));
  refresh();
}

/** Every idea without a stored banner gets the suggested one (herz where nothing fits). */
export async function applyMotifSuggestionsAction(): Promise<number> {
  const { coupleId } = await requireCouple();
  const open = await db
    .select({ id: ideas.id, title: ideas.title, note: ideas.note })
    .from(ideas)
    .where(and(eq(ideas.coupleId, coupleId), isNull(ideas.motif), isNull(ideas.archivedAt)));
  for (const idea of open) await db.update(ideas).set({ motif: suggestMotif(idea) }).where(eq(ideas.id, idea.id));
  refresh();
  return open.length;
}
