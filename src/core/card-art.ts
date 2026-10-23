// What a swipe card looks like and what the flower says about it (SWIPE-KARTE-V2.md §3, SWIPE-KARTE.md §4): a banner
// scene from the library (core/banners.ts – its pastel comes with it) and quips for "just looking", a like and a nope.
// Claude picks the scene and writes the quips when a card or idea is made; whatever is missing comes from the words
// (suggestMotif – nothing clear: herz) and from the category and the idea's own details (cost, place, size). Pure.

import { bannerOf, isMotif, motifPrompt, suggestMotif, type Motif } from "./banners";
import { categoryOf, type IdeaCategory } from "./categories";
import type { IdeaSize } from "@/lib/domain";

/** The old card pastels (ideas.color / deck_cards.color, no longer written – the banner brings its own). */
export const CARD_COLORS = ["rose", "green", "butter", "sky", "lilac"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export type CardQuips = { neutral: string[]; like: string[]; nope: string[] };

/** What the flower may say: short, lower case. */
export const QUIP_MAX = 48;


function cleanQuip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
  if (!s || s.length > QUIP_MAX) return null;
  return s;
}

/** Claude's answer for one card or idea, checked: a known scene, short quips. */
export function cleanCardArt(raw: { motif?: unknown; quips?: unknown }): { motif: Motif | null; quips: CardQuips | null } {
  const q = (raw.quips ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(cleanQuip).filter((s): s is string => s !== null).slice(0, 4) : []);
  const quips = { neutral: list(q.neutral), like: list(q.like), nope: list(q.nope) };
  return {
    motif: isMotif(raw.motif) ? raw.motif : null,
    quips: quips.neutral.length + quips.like.length + quips.nope.length ? quips : null,
  };
}

/** For the prompts: how Claude picks the scene. */
export function motifInstruction(): string {
  return `motif: the one key from this banner library that shows best what they do (use "herz" only if nothing fits): ${motifPrompt()}.`;
}

// --- Fallback --------------------------------------------------------------------------------------

const CATEGORY_QUIPS: Record<IdeaCategory, CardQuips> = {
  food: {
    neutral: ["ich esse nur sonne. aber ihr dürft.", "riecht nach einem guten abend.", "ich nehm die krümel."],
    like: ["lecker! ab ins beet damit.", "guten appetit, ihr zwei!"],
    nope: ["kompost? der koch weint jetzt.", "dann eben müsli."],
  },
  nature: {
    neutral: ["frische luft! meine lieblingsluft.", "da wachsen meine cousins.", "draußen? ich komm mit. im topf."],
    like: ["jaaa, raus mit euch!", "grün zu grün – perfekt."],
    nope: ["kompost? die bäume sind beleidigt.", "na gut, drinnen ist auch schön."],
  },
  culture: {
    neutral: ["kultur! ich bin ganz blatt.", "ich tu so, als hätt ich's verstanden.", "endlich was für den kopf."],
    like: ["bravo! ins beet damit.", "applaus, applaus!"],
    nope: ["kompost? kein vorhang für euch.", "dann halt ein andermal kultur."],
  },
  active: {
    neutral: ["ich mach stretching. mit den blättern.", "schwitzen zu zweit? mutig.", "ich feuer euch an!"],
    like: ["auf die plätze – gegossen!", "sportlich, sportlich!"],
    nope: ["kompost? das sofa freut sich.", "muskelkater gespart."],
  },
  creative: {
    neutral: ["macht mir was schönes. gern grün.", "kunst kommt von können. oder gießen.", "ich halt still. bin modell."],
    like: ["kreativ! ab ins beet.", "ich will ein bild davon!"],
    nope: ["kompost? die farben trocknen ein.", "dann ohne kleckern."],
  },
  cozy: {
    neutral: ["decke, tee, ihr zwei. fertig.", "gemütlich ist mein zweiter name.", "ich mach schon mal das licht aus."],
    like: ["kuschelig! ab ins beet.", "jaaa, sofa-alarm!"],
    nope: ["kompost? die decke ist traurig.", "na gut, dann raus mit euch."],
  },
  trip: {
    neutral: ["weg von hier? nehmt mich mit!", "ich war noch nie im zug.", "abenteuer! ich pack die gießkanne."],
    like: ["los geht's! ab ins beet.", "gute reise, ihr zwei!"],
    nope: ["kompost? der zug fährt ohne euch.", "dann bleiben wir halt hier."],
  },
  events: {
    neutral: ["da ist was los! ich hör's schon.", "einmal im leben, ihr zwei.", "ich würd mitsingen – hab nur keine lunge."],
    like: ["jaaa! ab ins beet damit!", "bühne frei für euch!"],
    nope: ["kompost? die bühne bleibt leer.", "na gut, dann ohne applaus."],
  },
  other: {
    neutral: ["hm. klingt nach euch.", "ich hab ein gutes gefühl.", "wär was neues fürs beet."],
    like: ["jaaa! ab ins beet damit!", "gute wahl, ihr zwei."],
    nope: ["kompost? na gut.", "weg damit. ich vergess es schnell."],
  },
};

type ArtInput = {
  id: string;
  title: string;
  note?: string | null;
  category?: string | null;
  costEur?: number | null;
  location?: string | null;
  size?: IdeaSize;
  motif?: string | null;
  quips?: Partial<CardQuips> | null;
};

/** Quips built from the idea's own details, so even old ideas sound like them. */
function detailQuips(card: ArtInput): string[] {
  const out: string[] = [];
  if (typeof card.costEur === "number") {
    if (card.costEur === 0) out.push("kostet nix. wie gießwasser.");
    else if (card.costEur >= 5) out.push(`${card.costEur} € sind ${Math.max(1, Math.round(card.costEur / 5))} säcke blumenerde. nur so.`);
  }
  const place = card.location?.split(/[,–(]/)[0].trim();
  if (place && place.length <= 22) out.push(`${place.toLocaleLowerCase("de-DE")}? da war ich noch nie.`);
  if (card.size === "large") out.push("einen halben tag? ich halt durch.");
  return out.filter((q) => q.length <= QUIP_MAX);
}

export type CardArt = { motif: Motif; hex: string; quips: CardQuips };

/** The stored scene and quips, with whatever is missing filled from the words, category and details. */
export function cardArt(card: ArtInput): CardArt {
  const category = categoryOf(card);
  const motif = isMotif(card.motif) ? card.motif : suggestMotif(card);
  const generic = CATEGORY_QUIPS[category];
  const own = (kind: keyof CardQuips) => (card.quips?.[kind] ?? []).filter((q) => typeof q === "string" && q.trim());
  const quips = {
    neutral: own("neutral").length ? own("neutral") : [...detailQuips(card), ...generic.neutral],
    like: own("like").length ? own("like") : generic.like,
    nope: own("nope").length ? own("nope") : generic.nope,
  };
  return { motif, hex: bannerOf(motif).bg, quips };
}

/** The n-th quip of a list, starting at a fixed place per card (no flicker on reload). */
export function pickQuip(list: string[], seed: string, n = 0): string {
  if (list.length === 0) return "";
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[(h + n) % list.length];
}

// --- One idea at a time (ideas they add themselves) -----------------------------------------------

export const ART_SYSTEM_PROMPT = [
  "You give a date idea of a young couple in Cologne its look on a swipe card and write what a cheeky little flower says about it.",
  motifInstruction(),
  `quips: German, all lower case, max ${QUIP_MAX - 3} characters each, playful and a little cheeky. Every quip refers to a detail of this idea (the place, the cost, the time, the activity), never generic.`,
  "neutral: 3 for just looking at it, like: 2 for when they plant it (swipe right), nope: 1–2 for the compost (swipe left).",
].join("\n");

/** Only what the card shows – no names, no notes about people. */
export function buildArtPrompt(idea: { title: string; note?: string | null; location?: string | null; costEur?: number | null; size: IdeaSize }): string {
  return [
    `Idea: ${idea.title}`,
    idea.note ? `Description: ${idea.note.slice(0, 300)}` : null,
    idea.location ? `Place: ${idea.location}` : null,
    typeof idea.costEur === "number" ? `Cost for both: about ${idea.costEur} euros` : null,
    `Length: ${idea.size === "large" ? "half a day or more" : "an evening, up to about 3 hours"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
