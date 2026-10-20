// What a swipe card looks like and what the flower says about it (SWIPE-KARTE.md §4): a pastel for the
// picture strip, one or two illustrations from a fixed library, and quips for "just looking", a like
// and a nope. Claude writes them when a card or idea is made; whatever is missing comes from the
// category and the idea's own details (cost, place, size). Pure.

import { categoryOf, type IdeaCategory } from "./categories";
import type { IdeaSize } from "@/lib/domain";

/** The five tile pastels – stored as a key, so nothing else can end up on a card. */
export const CARD_COLORS = ["rose", "green", "butter", "sky", "lilac"] as const;
export type CardColor = (typeof CARD_COLORS)[number];
export const CARD_COLOR_HEX: Record<CardColor, string> = {
  rose: "#F6DFD3",
  green: "#DCEBD9",
  butter: "#F7EBC4",
  sky: "#DCE7F5",
  lilac: "#E6E0F2",
};

/** The illustration library (components/illustrations.tsx draws them), grouped as in the start set. */
export const ILLUSTRATION_GROUPS = {
  essen: ["crepes", "teller", "glaeser"],
  musik: ["mikro", "gitarre"],
  draussen: ["baum", "sonne"],
  wasser: ["welle", "boot"],
  kultur: ["rahmen", "maske"],
  kreativ: ["pinsel", "ton"],
  sport: ["ball", "berg"],
  abends: ["mond", "kerze"],
  wellness: ["tasse", "dampf"],
  sonst: ["blume", "zug"],
} as const;
export type Illustration = (typeof ILLUSTRATION_GROUPS)[keyof typeof ILLUSTRATION_GROUPS][number];
export const ILLUSTRATIONS: readonly Illustration[] = Object.values(ILLUSTRATION_GROUPS).flat();

export type CardQuips = { neutral: string[]; like: string[]; nope: string[] };

/** What the flower may say: short, lower case. */
export const QUIP_MAX = 48;

export function isCardColor(value: unknown): value is CardColor {
  return (CARD_COLORS as readonly unknown[]).includes(value);
}
export function isIllustration(value: unknown): value is Illustration {
  return (ILLUSTRATIONS as readonly unknown[]).includes(value);
}

function cleanQuip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim().toLocaleLowerCase("de-DE");
  if (!s || s.length > QUIP_MAX) return null;
  return s;
}

/** Claude's answer for one card or idea, checked: a known color, 1–2 known illustrations, short quips. */
export function cleanCardArt(raw: { color?: unknown; illustrations?: unknown; quips?: unknown }): {
  color: CardColor | null;
  illustrations: Illustration[] | null;
  quips: CardQuips | null;
} {
  const illustrations = Array.isArray(raw.illustrations) ? [...new Set(raw.illustrations.filter(isIllustration))].slice(0, 2) : [];
  const q = (raw.quips ?? {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map(cleanQuip).filter((s): s is string => s !== null).slice(0, 4) : []);
  const quips = { neutral: list(q.neutral), like: list(q.like), nope: list(q.nope) };
  return {
    color: isCardColor(raw.color) ? raw.color : null,
    illustrations: illustrations.length ? illustrations : null,
    quips: quips.neutral.length + quips.like.length + quips.nope.length ? quips : null,
  };
}

/** For the prompt: the keys Claude may pick from. */
export function illustrationPrompt(): string {
  return Object.entries(ILLUSTRATION_GROUPS)
    .map(([group, keys]) => `${group}: ${keys.join(", ")}`)
    .join("; ");
}

// --- Fallback --------------------------------------------------------------------------------------

const CATEGORY_ART: Record<IdeaCategory, { color: CardColor; illustrations: Illustration[] }> = {
  food: { color: "rose", illustrations: ["teller"] },
  nature: { color: "green", illustrations: ["baum"] },
  culture: { color: "lilac", illustrations: ["rahmen"] },
  active: { color: "sky", illustrations: ["ball"] },
  creative: { color: "butter", illustrations: ["pinsel"] },
  cozy: { color: "butter", illustrations: ["tasse"] },
  trip: { color: "sky", illustrations: ["zug"] },
  events: { color: "lilac", illustrations: ["mikro"] },
  other: { color: "green", illustrations: ["blume"] },
};

// A closer picture from the title, before the category's own one (first match wins).
const ART_KEYWORDS: Array<[RegExp, Illustration]> = [
  [/crêpe|crepe|waffel|pfannkuchen|pancake|kuchen|backen/iu, "crepes"],
  [/karaoke|konzert|singen|mitsing|live ?musik|band\b|abba/iu, "mikro"],
  [/gitarre|musik machen|jam\b|open mic/iu, "gitarre"],
  [/wein|cocktail|bar\b|kölsch|bier|drink|weinprobe/iu, "glaeser"],
  [/boot|tretboot|kanu|kajak|paddeln|rudern|fähre|schiff/iu, "boot"],
  [/schwimm|freibad|see\b|rhein|baden|strand|wasser/iu, "welle"],
  [/sonnenuntergang|sonnenaufgang|picknick|wiese|sonne/iu, "sonne"],
  [/sterne|nacht|mond|abendspaziergang|planetarium/iu, "mond"],
  [/kerze|candle|dinner|romantisch/iu, "kerze"],
  [/theater|oper|kabarett|comedy|impro/iu, "maske"],
  [/museum|galerie|ausstellung|kunst/iu, "rahmen"],
  [/töpfer|keramik|ton\b/iu, "ton"],
  [/malen|zeichnen|pinsel|aquarell/iu, "pinsel"],
  [/wandern|klettern|bouldern|berg|siebengebirge|eifel/iu, "berg"],
  [/sauna|therme|wellness|massage|spa\b/iu, "dampf"],
  [/tee\b|kaffee|café|cafe|brunch|frühstück/iu, "tasse"],
  [/zug|tagesausflug|ausflug|trip\b/iu, "zug"],
];

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
  color?: string | null;
  illustrations?: string[] | null;
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

export type CardArt = { color: CardColor; hex: string; illustrations: Illustration[]; quips: CardQuips };

/** The stored look and quips, with whatever is missing filled from category and details. */
export function cardArt(card: ArtInput): CardArt {
  const category = categoryOf(card);
  const base = CATEGORY_ART[category];
  const stored = (card.illustrations ?? []).filter(isIllustration).slice(0, 2);
  const keyword = ART_KEYWORDS.find(([pattern]) => pattern.test(card.title))?.[1];
  const illustrations = stored.length ? stored : [keyword ?? base.illustrations[0]];
  const color = isCardColor(card.color) ? card.color : base.color;
  const generic = CATEGORY_QUIPS[category];
  const own = (kind: keyof CardQuips) => (card.quips?.[kind] ?? []).filter((q) => typeof q === "string" && q.trim());
  const quips = {
    neutral: own("neutral").length ? own("neutral") : [...detailQuips(card), ...generic.neutral],
    like: own("like").length ? own("like") : generic.like,
    nope: own("nope").length ? own("nope") : generic.nope,
  };
  return { color, hex: CARD_COLOR_HEX[color], illustrations, quips };
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
  "color: one of rose, green, butter, sky, lilac – a pastel that suits the idea.",
  `illustrations: one or two keys from this list that show what they do (two for a combination): ${illustrationPrompt()}.`,
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
