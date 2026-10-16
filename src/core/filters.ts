// One filter for the whole app: how long, how expensive, inside or outside.
// The wishlist, the swipe deck, "Was läuft" and the idea picker in /plan all
// use it, so a choice made in one place holds everywhere. Pure.

import { PLACE_SETTINGS, type IdeaSize, type PlaceSetting } from "@/lib/domain";

export const BUDGET_FILTERS = ["free", "cheap"] as const;
export type BudgetFilter = (typeof BUDGET_FILTERS)[number];

export type IdeaFilter = { size?: IdeaSize; budget?: BudgetFilter; setting?: PlaceSetting };

/** "Günstig" means at most this much for both. */
export const CHEAP_MAX_EUR = 20;

export const FILTER_GROUPS = [
  {
    key: "size",
    question: "Wie lang?",
    options: [
      { value: "small", label: "☕ Kurz" },
      { value: "large", label: "🎡 Lang" },
    ],
  },
  {
    key: "budget",
    question: "Was darf es kosten?",
    options: [
      { value: "free", label: "🆓 Gratis" },
      { value: "cheap", label: `💸 Bis ${CHEAP_MAX_EUR} €` },
    ],
  },
  {
    key: "setting",
    question: "Wo?",
    options: [
      { value: "indoor", label: "🏠 Drinnen" },
      { value: "outdoor", label: "🌳 Draußen" },
    ],
  },
] as const satisfies ReadonlyArray<{ key: keyof IdeaFilter; question: string; options: ReadonlyArray<{ value: string; label: string }> }>;

/** Whatever was stored (old versions, hand edits) – only known values survive. */
export function parseFilter(raw: unknown): IdeaFilter {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const filter: IdeaFilter = {};
  if (v.size === "small" || v.size === "large") filter.size = v.size;
  if ((BUDGET_FILTERS as readonly unknown[]).includes(v.budget)) filter.budget = v.budget as BudgetFilter;
  if ((PLACE_SETTINGS as readonly unknown[]).includes(v.setting)) filter.setting = v.setting as PlaceSetting;
  return filter;
}

export function activeFilterCount(filter: IdeaFilter): number {
  return [filter.size, filter.budget, filter.setting].filter(Boolean).length;
}

/** "☕ Kurz · 🆓 Gratis" – for the button and empty states. */
export function filterSummary(filter: IdeaFilter): string {
  return FILTER_GROUPS.flatMap((group) => group.options.filter((o) => filter[group.key] === o.value).map((o) => o.label)).join(" · ");
}

export type Filterable = {
  size?: IdeaSize | null;
  /** Rough cost for both; null = unknown. */
  costEur?: number | null;
  /** The source says "Eintritt frei". */
  free?: boolean | null;
  setting?: PlaceSetting | null;
};

/**
 * Unknown values pass a filter (an event has no size, a wishlist idea often
 * no setting) – except "Gratis", which needs to know it is free.
 */
export function matchesIdeaFilter(item: Filterable, filter: IdeaFilter): boolean {
  if (filter.size && item.size && item.size !== filter.size) return false;
  if (filter.setting && item.setting && item.setting !== filter.setting) return false;
  const isFree = item.free === true || item.costEur === 0;
  if (filter.budget === "free" && !isFree) return false;
  if (filter.budget === "cheap" && !isFree && typeof item.costEur === "number" && item.costEur > CHEAP_MAX_EUR) return false;
  return true;
}

/** Lines for Claude when new ideas should match the filter. */
export function filterPrompt(filter: IdeaFilter): string[] {
  const lines: string[] = [];
  if (filter.size === "small") lines.push("All ideas must be small dates (up to about 3 hours).");
  if (filter.size === "large") lines.push("All ideas must be big dates (half a day or more).");
  if (filter.budget === "free") lines.push("All ideas must be free (0 euros).");
  if (filter.budget === "cheap") lines.push(`All ideas must be cheap (at most about ${CHEAP_MAX_EUR} euros for both).`);
  if (filter.setting === "indoor") lines.push("All ideas must work indoors.");
  if (filter.setting === "outdoor") lines.push("All ideas should be outdoors.");
  return lines;
}
