"use server";

import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { linkToIdea, type LinkIdeaResult } from "@/server/link-ideas";
import { getCoupleSettings } from "@/server/settings";

/** Turns a shared link into a draft idea (not saved – the form shows it first). */
export async function analyzeLinkAction(input: string): Promise<LinkIdeaResult> {
  const ctx = await requireCouple();
  if (typeof input !== "string" || input.length > 2000) return { ok: false, error: "invalid", url: null };
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  return linkToIdea(ctx, input, now);
}
