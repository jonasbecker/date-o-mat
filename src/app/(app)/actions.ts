"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { applySettingsToOpenCycle, ensureCurrentCycle } from "@/server/cycles";
import { getCoupleSettings, setFirstPlanner } from "@/server/settings";
import { rejectSuggestion } from "@/server/suggestions";

/** Alternating mode: the other person takes over this round (and the order flips from here on). */
export async function swapTurnAction() {
  const { user, partner, coupleId } = await requireCouple();
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  if (cycle?.status === "open" && cycle.mode === "alternating" && cycle.plannerId) {
    const newPlanner = cycle.plannerId === user.id ? partner.id : user.id;
    const otherId = newPlanner === user.id ? partner.id : user.id;
    // plannerForSeq: odd rounds → first planner. Pick the first planner so this round goes to newPlanner.
    await setFirstPlanner(coupleId, cycle.seq % 2 === 1 ? newPlanner : otherId);
    await applySettingsToOpenCycle(coupleId, now);
  }
  refresh();
}

export async function rejectSuggestionAction(suggestionId: string) {
  const { user, coupleId } = await requireCouple();
  const id = z.uuid().safeParse(suggestionId);
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  const cycle = await ensureCurrentCycle(coupleId, now);
  if (id.success && cycle) {
    await rejectSuggestion(cycle.id, id.data, user.id, now);
  }
  refresh();
}
