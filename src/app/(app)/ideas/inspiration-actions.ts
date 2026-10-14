"use server";

import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { CURATED_IDEAS } from "@/core/curated-ideas";
import { pickSurprise, type SurpriseCandidate } from "@/core/surprise";
import { formatCost } from "@/lib/idea-input";
import type { IdeaSize } from "@/lib/domain";
import { requireCouple } from "@/server/auth/dal";
import { db } from "@/server/db";
import { ideas } from "@/server/db/schema";
import { listIdeas } from "@/server/ideas";
import { BUDGETS, MOODS, SETTINGS, type AiIdea } from "@/core/ai-ideas";
import { generateIdeas } from "@/server/ai-ideas";
import { coupleNow } from "@/server/clock";
import { getCoupleSettings } from "@/server/settings";

/** Puts a Köln idea on the wishlist (once) and returns the wishlist id. */
async function saveCurated(coupleId: string, userId: string, curatedId: string): Promise<string | null> {
  const idea = CURATED_IDEAS.find((i) => i.id === curatedId);
  if (!idea) return null;
  const [existing] = await db
    .select({ id: ideas.id })
    .from(ideas)
    .where(and(eq(ideas.coupleId, coupleId), eq(ideas.source, "curated"), eq(ideas.externalRef, idea.id), isNull(ideas.archivedAt)))
    .limit(1);
  if (existing) return existing.id;
  const [row] = await db
    .insert(ideas)
    .values({
      coupleId,
      title: idea.title,
      size: idea.size,
      note: idea.note,
      costEur: idea.costEur,
      location: idea.location,
      source: "curated",
      externalRef: idea.id,
      createdById: userId,
      updatedById: userId,
    })
    .returning({ id: ideas.id });
  return row.id;
}

export async function saveCuratedAction(curatedId: string): Promise<{ ideaId: string | null }> {
  const { user, coupleId } = await requireCouple();
  const id = z.string().max(60).safeParse(curatedId);
  const ideaId = id.success ? await saveCurated(coupleId, user.id, id.data) : null;
  refresh();
  return { ideaId };
}

export type SurpriseView = {
  key: string;
  title: string;
  size: IdeaSize;
  note: string | null;
  meta: string | null;
  /** Wishlist idea id, or null for a Köln idea that is not on the wishlist yet. */
  ideaId: string | null;
  curatedId: string | null;
};

/** Draws a random idea: your wishlist (weighted double) plus Köln ideas you have not saved yet. */
export async function surpriseAction(recent: string[], size?: IdeaSize): Promise<SurpriseView | null> {
  const { coupleId } = await requireCouple();
  const recentKeys = z.array(z.string().max(80)).max(20).catch([]).parse(recent);
  const sizeFilter = z.enum(["small", "large"]).optional().catch(undefined).parse(size);
  const own = await listIdeas(coupleId);
  const savedCurated = new Set(own.filter((i) => i.source === "curated").map((i) => i.externalRef));

  type Candidate = SurpriseCandidate & { view: SurpriseView };
  const meta = (cost: number | null, location: string | null) => [formatCost(cost), location && `📍 ${location}`].filter(Boolean).join(" · ") || null;
  const candidates: Candidate[] = [
    ...own.map((i) => ({
      key: `idea:${i.id}`,
      title: i.title,
      size: i.size,
      fromWishlist: true,
      view: { key: `idea:${i.id}`, title: i.title, size: i.size, note: i.note, meta: meta(i.costEur, i.location), ideaId: i.id, curatedId: null },
    })),
    ...CURATED_IDEAS.filter((c) => !savedCurated.has(c.id)).map((c) => ({
      key: `curated:${c.id}`,
      title: c.title,
      size: c.size,
      fromWishlist: false,
      view: { key: `curated:${c.id}`, title: c.title, size: c.size, note: c.note, meta: meta(c.costEur, c.location), ideaId: null, curatedId: c.id },
    })),
  ];
  return pickSurprise(candidates, { recent: recentKeys, size: sizeFilter })?.view ?? null;
}


export type AiIdeasResponse = { ok: true; ideas: AiIdea[]; weather: string | null; left: number } | { ok: false; message: string };

const AI_ERRORS = {
  off: "Die KI ist auf dem Server noch nicht eingerichtet.",
  limit: "Für heute sind die KI-Vorschläge aufgebraucht (20 pro Tag). Morgen gibt's neue!",
  failed: "Die KI hat gerade keine Antwort geliefert. Versuch es gleich nochmal.",
} as const;

const aiInput = z.object({
  budget: z.enum(BUDGETS),
  mood: z.enum(MOODS),
  setting: z.enum(SETTINGS),
  size: z.enum(["small", "large"]).optional(),
  slot: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).nullable(),
});

export async function aiIdeasAction(input: z.input<typeof aiInput>): Promise<AiIdeasResponse> {
  const ctx = await requireCouple();
  const parsed = aiInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: AI_ERRORS.failed };
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const { slot, ...prefs } = parsed.data;
  const result = await generateIdeas(ctx, { ...prefs, slot: slot ? { start: new Date(slot.start), end: new Date(slot.end) } : null }, now);
  return result.ok ? result : { ok: false, message: AI_ERRORS[result.error] };
}

const aiIdea = z.object({
  title: z.string().trim().min(1).max(120),
  size: z.enum(["small", "large"]),
  note: z.string().max(1000),
  costEur: z.number().int().min(0).max(10_000).nullable(),
  location: z.string().max(120).nullable(),
});

/** Puts an AI suggestion on the wishlist and returns its id (for "Nehmen" on the plan page). */
export async function saveAiIdeaAction(input: z.input<typeof aiIdea>): Promise<{ ideaId: string | null }> {
  const { user, coupleId } = await requireCouple();
  const parsed = aiIdea.safeParse(input);
  if (!parsed.success) return { ideaId: null };
  const [row] = await db
    .insert(ideas)
    .values({ ...parsed.data, note: parsed.data.note || null, coupleId, source: "ai", createdById: user.id, updatedById: user.id })
    .returning({ id: ideas.id });
  refresh();
  return { ideaId: row.id };
}
