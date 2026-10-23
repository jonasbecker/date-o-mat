// The view behind a tile of the seed shelf ("kurz.", "draußen." …, docs/design/garten/ideen-kategorie/): one layout for
// every kind – only the title, the subtitle, the flower's quips and the ideas change. Here: what each kind says, the
// chips above the list, the flower's tip and the two groups ("passt diese Woche" / "irgendwann").
import type { IdeaSize, PlaceSetting } from "@/lib/domain";

export type CategoryKind = "all" | "match" | "swiped" | "small" | "large" | "outdoor" | "indoor" | "local" | "own";

export const CATEGORY_VIEW: Record<CategoryKind, { title: string; subtitle: string; quips: string[] }> = {
  all: { title: "alle.", subtitle: "das ganze regal", quips: ["alles, was ihr gesät habt.", "such dir was aus. ich schau zu.", "mein tipp liegt ganz oben."] },
  match: { title: "matchlinge.", subtitle: "beide haben's gepflanzt", quips: ["ihr seid euch einig. süß.", "die keimen schon!", "zwei herzen, ein samen."] },
  swiped: { title: "meine likes.", subtitle: "was du gepflanzt hast", quips: ["du hast geschmack.", "alles deine lieblinge.", "mal sehen, wer mitzieht."] },
  small: { title: "kurz.", subtitle: "keimt an einem Abend", quips: ["kurz & gut. so wie ich.", "mein tipp liegt ganz oben.", "ein abend reicht für was schönes."] },
  large: { title: "lang.", subtitle: "wächst einen halben Tag", quips: ["pack snacks ein. und mich.", "nehmt euch zeit. ich warte.", "ein halber tag nur für euch."] },
  outdoor: { title: "draußen.", subtitle: "braucht Sonne", quips: ["sonne! endlich mal licht.", "frische luft tut gut.", "nehmt 'ne jacke mit."] },
  indoor: { title: "drinnen.", subtitle: "Fensterbank-Sorten", quips: ["fensterbank-wetter. ich bin dabei.", "regen? egal.", "kuschelig. gefällt mir."] },
  local: { title: "mit ort.", subtitle: "Veedel & Rhein", quips: ["kenn ich. war ich aber nie.", "da müsst ihr hin.", "nimm mich mit?"] },
  own: { title: "eigene.", subtitle: "von euch gesät", quips: ["selbst gesät? stolz auf euch.", "eure ideen sind die besten.", "hausgemacht. lecker."] },
};

/** "39 Ideen" / "1 Idee". */
export function ideaCount(n: number): string {
  return `${n} ${n === 1 ? "Idee" : "Ideen"}`;
}

// --- Chips ---------------------------------------------------------------------------------------

export type CategoryChip = "all" | "free" | "evening" | "indoor" | "outdoor";
export const CHIP_LABEL: Record<CategoryChip, string> = { all: "alle", free: "gratis", evening: "ein Abend", indoor: "drinnen", outdoor: "draußen" };

export type ChipIdea = { size: IdeaSize; costEur: number | null; setting?: PlaceSetting | null };

export function chipMatches(idea: ChipIdea, chip: CategoryChip): boolean {
  switch (chip) {
    case "all":
      return true;
    case "free":
      return idea.costEur === 0;
    case "evening":
      return idea.size === "small";
    case "indoor":
    case "outdoor":
      return idea.setting === chip;
  }
}

/**
 * The chips of a view with their counts: a chip that only repeats the view ("ein Abend" in "kurz.", "drinnen" in
 * "drinnen.") or finds nothing is left out; "alle" always stays.
 */
export function chipsFor(kind: CategoryKind, ideas: ChipIdea[]): { chip: CategoryChip; count: number }[] {
  const same: Partial<Record<CategoryKind, CategoryChip[]>> = { small: ["evening"], large: ["evening"], indoor: ["indoor", "outdoor"], outdoor: ["indoor", "outdoor"] };
  return (Object.keys(CHIP_LABEL) as CategoryChip[])
    .filter((chip) => !same[kind]?.includes(chip))
    .map((chip) => ({ chip, count: ideas.filter((i) => chipMatches(i, chip)).length }))
    .filter(({ chip, count }) => chip === "all" || count > 0);
}

// --- The flower's tip and the groups ------------------------------------------------------------

/** How far ahead "passt diese Woche" looks. */
export const WEEK_DAYS = 7;

export type TipIdea = {
  id: string;
  /** The earliest free time of both that fits the idea (ms), or null. */
  slotStart: number | null;
  /** The other one liked it (swiped right, or it is a match). */
  partnerLiked: boolean;
  /** When a date with it was last planned (ms), null = never. */
  lastPlannedAt: number | null;
  createdAt: number;
};

/** An idea's earliest free time of both: "Fr 30.10. · ab 19:30" (server/idea-times.ts). */
export type IdeaTime = { startIso: string; label: string };
export type IdeaTimes = { calendars: boolean; slots: Record<string, IdeaTime | null> };

export function fitsThisWeek(idea: Pick<TipIdea, "slotStart">, now: number): boolean {
  return idea.slotStart !== null && idea.slotStart - now <= WEEK_DAYS * 86_400_000;
}

/**
 * The order "anderer ↻" goes through: what fits a free time this week first; within that what the other one liked,
 * then what was planned longest ago (never planned first), then the oldest.
 */
export function tipOrder<T extends TipIdea>(ideas: T[], now: number): T[] {
  const key = (i: T) => [fitsThisWeek(i, now) ? 0 : 1, i.partnerLiked ? 0 : 1, i.lastPlannedAt ?? -Infinity, i.createdAt] as const;
  return [...ideas].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let n = 0; n < ka.length; n++) if (ka[n] !== kb[n]) return ka[n] < kb[n] ? -1 : 1;
    return 0;
  });
}

/** The list under the tip, without the tip: this week (soonest first) and the rest (in the order given). */
export function groupIdeas<T extends TipIdea>(ideas: T[], tipId: string | null, now: number): { week: T[]; later: T[] } {
  const rest = ideas.filter((i) => i.id !== tipId);
  return {
    week: rest.filter((i) => fitsThisWeek(i, now)).sort((a, b) => a.slotStart! - b.slotStart!),
    later: rest.filter((i) => !fitsThisWeek(i, now)),
  };
}

// --- One row's words -------------------------------------------------------------------------------

const DURATION: Record<IdeaSize, string> = { small: "ein Abend", large: "halber Tag" };

/** "ein Abend · gratis · Rheinauhafen" – shown in caps; the place only up to its first comma. */
export function ideaMeta(idea: { size: IdeaSize; costEur: number | null; location: string | null }): string {
  const cost = idea.costEur === null ? null : idea.costEur === 0 ? "gratis" : `~${idea.costEur} €`;
  const place = idea.location?.split(",")[0].trim() || null;
  return [DURATION[idea.size], cost, place].filter(Boolean).join(" · ");
}
