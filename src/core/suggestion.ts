// Suggestion mode: the app picks a slot and an idea; you accept or reject.

import type { IdeaSize, PlaceSetting } from "@/lib/domain";
import { slotModeFor, type SlotLists, type SlotMode } from "./slot-modes";
import type { Slot } from "./slots";

export type IdeaChoice = { ideaId: string | null; title: string; size: IdeaSize; addedAt: Date; note?: string | null; setting?: PlaceSetting | null };
export type RejectedSuggestion = { startsAt: Date; size: IdeaSize; ideaId: string | null };

export type Suggestion = { slot: Slot; idea: IdeaChoice | null };

/**
 * Takes the idea that has waited longest (small ones normally, large ones in every other
 * round for variety; not one rejected in this round) and gives it the best free time *for
 * that idea* – outdoor ideas look at daylight and weather, the others at the plain ranking.
 * Without any idea that fits a free time: the best plain slot, idea left open.
 */
export function pickSuggestion(params: {
  small: Slot[];
  large: Slot[];
  /** The same free times ranked for outdoor ideas (and for those that want the dark). */
  outdoor?: SlotLists;
  outdoorDark?: SlotLists;
  preferLarge: boolean;
  ideas: IdeaChoice[];
  rejected: RejectedSuggestion[];
}): Suggestion | null {
  const { small, large, preferLarge, ideas, rejected } = params;
  const lists: Record<SlotMode, SlotLists> = {
    standard: { small, large },
    outdoor: params.outdoor ?? { small, large },
    outdoorDark: params.outdoorDark ?? { small, large },
  };
  const wasRejected = (slot: Slot) => rejected.some((r) => r.size === slot.size && r.startsAt.getTime() === slot.start.getTime());
  const rejectedIdeas = new Set(rejected.map((r) => r.ideaId).filter(Boolean));

  const sizes: IdeaSize[] = preferLarge ? ["large", "small"] : ["small", "large"];
  for (const size of sizes) {
    const candidates = ideas.filter((i) => i.size === size && !(i.ideaId && rejectedIdeas.has(i.ideaId))).sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime());
    for (const idea of candidates) {
      const slot = lists[slotModeFor(idea)][size].find((s) => !wasRejected(s));
      if (slot) return { slot, idea };
    }
  }

  const slot = (preferLarge ? [...large, ...small] : [...small, ...large]).find((s) => !wasRejected(s));
  return slot ? { slot, idea: null } : null;
}
