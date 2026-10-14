// "✨ Ideen von der KI": three date ideas from Claude, fitted to time, weather, budget and mood.
import "server-only";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AI_DAILY_LIMIT, AI_SYSTEM_PROMPT, buildIdeaPrompt, cleanAiIdeas, type AiIdea, type Budget, type Mood, type SettingPref } from "@/core/ai-ideas";
import type { IdeaSize } from "@/lib/domain";
import type { CoupleContext } from "@/server/auth/dal";
import { aiRequestsToday, anthropic, recordAiUsage } from "@/server/anthropic";
import { env } from "@/server/env";
import { listIdeas } from "@/server/ideas";
import { pastDates } from "@/server/reviews";
import { weatherFor } from "@/server/weather";

export const IDEAS_MODEL = "claude-haiku-5-5";

const ResultSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      why: z.string(),
      size: z.enum(["small", "large"]),
      cost_eur: z.number().nullable(),
      location: z.string().nullable(),
      setting: z.enum(["indoor", "outdoor"]),
    }),
  ),
});

export type IdeasResult = { ok: true; ideas: AiIdea[]; weather: string | null; left: number } | { ok: false; error: "off" | "limit" | "failed" };

export async function generateIdeas(
  ctx: CoupleContext,
  prefs: { budget: Budget; mood: Mood; setting: SettingPref; size?: IdeaSize; slot: { start: Date; end: Date } | null },
  now: Date,
): Promise<IdeasResult> {
  if (!env().ai) return { ok: false, error: "off" };
  const used = await aiRequestsToday(ctx.coupleId, "ideas", now);
  if (used >= AI_DAILY_LIMIT) return { ok: false, error: "limit" };

  const [wishlist, past, weather] = await Promise.all([
    listIdeas(ctx.coupleId),
    pastDates(ctx.coupleId),
    prefs.slot ? weatherFor(prefs.slot.start, prefs.slot.end, now) : Promise.resolve(null),
  ]);
  const wishlistTitles = wishlist.map((i) => i.title);
  // Only titles and hearts – no names, notes or calendar data leave the app.
  const pastDatesForPrompt = past.map((d) => ({
    title: d.title,
    hearts: d.reviews.length ? Math.round((d.reviews.reduce((sum, r) => sum + r.rating, 0) / d.reviews.length) * 10) / 10 : null,
  }));
  const prompt = buildIdeaPrompt({ now, slot: prefs.slot, weather, budget: prefs.budget, mood: prefs.mood, setting: prefs.setting, size: prefs.size, wishlist: wishlistTitles, pastDates: pastDatesForPrompt });

  try {
    const response = await anthropic().messages.parse({
      model: IDEAS_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(ResultSchema) },
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });
    await recordAiUsage({ coupleId: ctx.coupleId, userId: ctx.user.id, kind: "ideas", model: IDEAS_MODEL, usage: response.usage });
    if (response.stop_reason === "refusal" || !response.parsed_output) return { ok: false, error: "failed" };
    const ideas = cleanAiIdeas(response.parsed_output.ideas, wishlistTitles, prefs.size);
    if (ideas.length === 0) return { ok: false, error: "failed" };
    return { ok: true, ideas, weather, left: AI_DAILY_LIMIT - used - 1 };
  } catch (error) {
    console.error("[ai] idea suggestions failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "failed" };
  }
}
