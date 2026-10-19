// Which ranking of the free times fits an idea: the plain one, one for outdoor ideas
// (daylight + weather), or one for outdoor ideas that want the dark (stars, sunsets).

import type { PlaceSetting } from "@/lib/domain";
import { darknessWanted } from "./outdoor";
import type { Slot } from "./slots";

export type SlotMode = "standard" | "outdoor" | "outdoorDark";
export type SlotLists = { small: Slot[]; large: Slot[] };

export function slotModeFor(idea: { title: string; note?: string | null; setting?: PlaceSetting | null } | null | undefined): SlotMode {
  if (!idea || idea.setting !== "outdoor") return "standard";
  return darknessWanted(idea.title, idea.note) ? "outdoorDark" : "outdoor";
}
