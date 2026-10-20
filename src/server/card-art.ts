// The look and quips of an idea someone adds themselves (SWIPE-KARTE.md §4): one small Claude call
// right after it is saved, stored on the idea – never made again when it is shown. Deck cards get
// theirs in their own batch call (server/deck.ts). Without AI the card uses core/card-art.ts.
import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ART_SYSTEM_PROMPT, buildArtPrompt, CARD_COLORS, cleanCardArt } from "@/core/card-art";
import { anthropic, recordAiUsage, reserveAiRequest } from "@/server/anthropic";
import { db } from "@/server/db";
import { ideas } from "@/server/db/schema";
import { env } from "@/server/env";

export const ART_MODEL = "claude-haiku-5-5";

const ArtSchema = z.object({
  color: z.enum(CARD_COLORS),
  // Checked against the library afterwards (cleanCardArt).
  illustrations: z.array(z.string()),
  quips: z.object({ neutral: z.array(z.string()), like: z.array(z.string()), nope: z.array(z.string()) }),
});

/** Best effort: off, over the day's limit or failing, the idea simply keeps the fallback. */
export async function paintIdea(coupleId: string, ideaId: string, now = new Date()): Promise<void> {
  if (!env().ai) return;
  try {
    const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.coupleId, coupleId)));
    if (!idea || idea.quips) return;
    const requestId = await reserveAiRequest({ coupleId, kind: "art", model: ART_MODEL, now });
    if (!requestId) return;
    const response = await anthropic().messages.parse({
      model: ART_MODEL,
      max_tokens: 800,
      output_config: { effort: "low", format: zodOutputFormat(ArtSchema) },
      system: ART_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildArtPrompt(idea) }],
    });
    await recordAiUsage(requestId, response.usage);
    if (response.stop_reason === "refusal" || !response.parsed_output) return;
    const art = cleanCardArt(response.parsed_output);
    await db
      .update(ideas)
      .set({ color: art.color, illustrations: art.illustrations, quips: art.quips })
      .where(and(eq(ideas.id, ideaId), eq(ideas.coupleId, coupleId)));
  } catch (error) {
    console.warn("[art] painting the idea failed", error instanceof Error ? error.message : error);
  }
}
