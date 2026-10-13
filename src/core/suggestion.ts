// Suggestion mode: the app picks a slot and an idea; you accept or reject.

import type { IdeaSize } from "@/lib/domain";
import type { Slot } from "./slots";

export type IdeaChoice = { ideaId: string | null; title: string; size: IdeaSize; addedAt: Date };
export type RejectedSuggestion = { startsAt: Date; size: IdeaSize; ideaId: string | null };

export type Suggestion = { slot: Slot; idea: IdeaChoice | null };

/**
 * Picks the first slot nobody rejected yet – small dates normally, large ones
 * in every other round for variety – and pairs it with the idea that has been
 * waiting longest on the wishlist (and was not rejected in this round).
 */
export function pickSuggestion(params: {
  small: Slot[];
  large: Slot[];
  preferLarge: boolean;
  ideas: IdeaChoice[];
  rejected: RejectedSuggestion[];
}): Suggestion | null {
  const { small, large, preferLarge, ideas, rejected } = params;
  const wasRejected = (slot: Slot) =>
    rejected.some((r) => r.size === slot.size && r.startsAt.getTime() === slot.start.getTime());

  const ordered = preferLarge ? [...large, ...small] : [...small, ...large];
  const slot = ordered.find((s) => !wasRejected(s));
  if (!slot) return null;

  const rejectedIdeas = new Set(rejected.map((r) => r.ideaId).filter(Boolean));
  const idea =
    ideas
      .filter((i) => i.size === slot.size && !(i.ideaId && rejectedIdeas.has(i.ideaId)))
      .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())[0] ?? null;

  return { slot, idea };
}
