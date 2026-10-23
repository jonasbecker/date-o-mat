// The swipe deck ("Entdecken"): Claude makes batches of date ideas, each
// person swipes on their own, and a card becomes a wishlist idea only when
// both like it. Pure – the server stores cards and swipes and calls Claude.

import type { CuratedIdea } from "./curated-ideas";
import { categoryFromTheme, inferCategory, type IdeaCategory } from "./categories";
import { cleanCardArt, motifInstruction, QUIP_MAX, type CardArt, type CardQuips } from "./card-art";
import type { Motif } from "./banners";
import type { CardWhen } from "./card-when";
import { filterPrompt, matchesIdeaFilter, type IdeaFilter } from "./filters";
import { DateTime } from "luxon";
import { APP_TIMEZONE, SEASON_KEYS, type DeckCardKind, type EventMix, type IdeaSize, type PlaceSetting, type SeasonKey, type SwipeVerdict } from "@/lib/domain";

/** Cards per batch, and when to make the next one. */
export const DECK_BATCH_SIZE = 20;
export const DECK_REFILL_BELOW = 5;
/** No more automatic batches while this many cards are still open (one person may not swipe for a while). */
export const DECK_MAX_OPEN = 60;
/** Automatic batches per day; the rest of the daily AI limit is for "Mehr davon" by hand. */
export const DECK_AUTO_BATCHES_PER_DAY = 3;

// --- No repeats ---------------------------------------------------------------------------------

const STOPWORDS = new Set(
  "der die das den dem des ein eine einen einem einer und oder mit im in am an auf zum zur für fur von vom bei beim nach zu ins aus euer eure eurem euren ihr uns wir mal".split(" "),
);

/** Words that carry the meaning of a title: lower case, no emoji/punctuation, no filler words. */
export function titleWords(title: string): string[] {
  const words = title
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

/** Stored per card (unique per couple): the sorted meaning words. */
export function dedupeKey(title: string): string {
  return titleWords(title).sort().join(" ");
}

/**
 * "Picknick im Stadtwald" vs "Stadtwald-Picknick" → duplicate. Two keys are the
 * same idea when most of their words overlap (Jaccard ≥ 0.6) or one contains the other.
 */
export function isNearDuplicate(key: string, existing: Iterable<string>): boolean {
  const words = new Set(key.split(" ").filter(Boolean));
  if (words.size === 0) return true;
  for (const other of existing) {
    const otherWords = new Set(other.split(" ").filter(Boolean));
    if (otherWords.size === 0) continue;
    let common = 0;
    for (const w of words) if (otherWords.has(w)) common++;
    const union = words.size + otherWords.size - common;
    if (common / union >= 0.6) return true;
    if (common === Math.min(words.size, otherWords.size) && common >= 2) return true;
  }
  return false;
}

// --- Variety ---------------------------------------------------------------------------------

export const DECK_THEMES = [
  { key: "food", label: "Essen & Trinken", prompt: "food and drinks (restaurants, street food, cooking, tastings)" },
  { key: "nature", label: "Natur", prompt: "nature and fresh air (parks, Rhine, forests, lakes)" },
  { key: "culture", label: "Kultur", prompt: "culture (museums, theatre, cinema, readings, concerts)" },
  { key: "active", label: "Aktiv", prompt: "active things (sports, games, moving together)" },
  { key: "creative", label: "Kreativ", prompt: "creative things (making, painting, crafting, music)" },
  { key: "cozy", label: "Gemütlich", prompt: "cozy evenings (at home or somewhere snug)" },
  { key: "new", label: "Neu & verrückt", prompt: "unusual, quirky things they have probably never done" },
  { key: "free", label: "Gratis", prompt: "things that cost nothing" },
  { key: "romantic", label: "Romantisch", prompt: "romantic moments" },
  { key: "trip", label: "Ausflug", prompt: "half-day or day trips from Cologne (NRW, by train)" },
  { key: "learn", label: "Was lernen", prompt: "learning something together (workshops, courses, tours)" },
  { key: "night", label: "Abends unterwegs", prompt: "evenings out (bars, live music, night walks)" },
] as const;
export type DeckTheme = (typeof DECK_THEMES)[number]["key"];

/** Four themes per batch, rotating, so batch after batch covers everything. */
export function pickThemes(batch: number, count = 4): Array<(typeof DECK_THEMES)[number]> {
  const start = (batch * count) % DECK_THEMES.length;
  return Array.from({ length: count }, (_, i) => DECK_THEMES[(start + i) % DECK_THEMES.length]);
}

const SEASONS = [
  { months: [12, 1, 2], de: "Winter", en: "winter" },
  { months: [3, 4, 5], de: "Frühling", en: "spring" },
  { months: [6, 7, 8], de: "Sommer", en: "summer" },
  { months: [9, 10, 11], de: "Herbst", en: "autumn" },
] as const;

export function seasonOf(date: Date, zone = APP_TIMEZONE): { de: string; en: string } {
  const month = DateTime.fromJSDate(date, { zone }).month;
  const season = SEASONS.find((s) => (s.months as readonly number[]).includes(month))!;
  return { de: season.de, en: season.en };
}

export const EVENT_MIX_LABEL: Record<EventMix, string> = { none: "Keine", some: "Ein paar", lots: "Viele" };
const COMBOS: Record<EventMix, number> = { none: 0, some: 3, lots: 7 };

export function comboCount(mix: EventMix, availableEvents: number): number {
  return Math.min(COMBOS[mix], availableEvents);
}

// --- The prompt ---------------------------------------------------------------------------------

export type PromptEvent = { title: string; when: string; venue: string | null; price: string | null };

export type DeckPromptInput = {
  now: Date;
  weather: string | null;
  themes: Array<{ prompt: string }>;
  ideaCount: number;
  events: PromptEvent[];
  comboCount: number;
  /** What they liked or matched recently (titles). */
  liked: string[];
  /** What they swiped away recently (titles). */
  passed: string[];
  /** Everything they have seen or have on the wishlist – nothing of this again. */
  exclude: string[];
  /** Anniversary/birthday coming up (a line for the prompt). */
  specialDays?: string | null;
  /** Budget left this month in euros, if they set one (M18). */
  budgetLeft?: number | null;
  /** The shared filter: "Mehr holen" makes cards that match it. */
  focus?: IdeaFilter;
};

export const DECK_SYSTEM_PROMPT = [
  "You create date ideas for a young couple (students) in Cologne, Germany. They swipe through them like on a dating app.",
  "Every idea must be concrete and doable: say what they do and, if it helps, where (a real district, park, venue type or well-known place in or near Cologne).",
  "Do not invent specific events, dates, opening hours or prices. Rough cost estimates are fine.",
  "Write in German, casual and warm. title: max 60 characters, catchy. description: 1–2 sentences that make them want to go.",
  "emoji: one fitting emoji. size: \"small\" up to about 3 hours, \"large\" half a day or more. cost_eur: rough total for both (0 if free). setting: indoor or outdoor.",
  "theme: one of the given theme keys. wildcard: true for ideas that are deliberately different from their usual taste.",
  "best_season: when the idea fits best (spring, summer, autumn, winter) or any.",
  "Combo cards build on one of the listed real events: event_index is its number, the idea adds something that fits before or after (e.g. dinner nearby, a walk, a drink). For normal ideas event_index is null.",
  "Never repeat an idea from the exclude list, not even reworded.",
  `Each card also gets its banner on the swipe card – ${motifInstruction()}`,
  `quips: what a cheeky little flower says about the card – German, all lower case, max ${QUIP_MAX - 3} characters each, playful.`,
  "Every quip refers to a detail of this idea (the place, the cost, the time, the activity), never generic. neutral: 3 for just looking at it, like: 2 for when they plant it (swipe right), nope: 1–2 for the compost (swipe left).",
  'Example for "Crêpes im Belgischen Viertel, dann ABBA": neutral "crêpes UND abba? ich wär dabei.", "40 € sind 8 säcke blumenerde. nur so."; like "dancing queen, young and … gegossen!"; nope "kompost? die crêpes weinen jetzt."',
].join("\n");

export function buildDeckPrompt(input: DeckPromptInput, zone = APP_TIMEZONE): string {
  const now = DateTime.fromJSDate(input.now, { zone }).setLocale("de");
  const season = seasonOf(input.now, zone);
  const lines = [
    `Today is ${now.toFormat("cccc, d. LLLL yyyy")} (${season.en}). Ideas must fit the season.`,
    `Weather in Cologne in the next days: ${input.weather ?? "unknown"}.`,
    `Make ${input.ideaCount} normal ideas. Themes for this batch (spread the ideas over them): ${input.themes.map((t) => t.prompt).join("; ")}.`,
    "About a quarter of the ideas should be wildcards: something they would not pick themselves.",
  ];
  if (input.focus) lines.push(...filterPrompt(input.focus));
  if (typeof input.budgetLeft === "number") {
    lines.push(
      input.budgetLeft <= 10
        ? "Their date budget for this month is nearly used up: prefer free ideas."
        : `They have about ${input.budgetLeft} euros left for dates this month: most ideas should cost clearly less.`,
    );
  }
  if (input.comboCount > 0) {
    lines.push(`Also make ${input.comboCount} combo cards, each with a different event from this list:`);
    input.events.forEach((e, i) => lines.push(`${i}: ${e.title} – ${e.when}${e.venue ? ` – ${e.venue}` : ""}${e.price ? ` – ${e.price}` : ""}`));
  }
  if (input.specialDays) lines.push(input.specialDays);
  if (input.liked.length) lines.push(`They liked: ${input.liked.slice(0, 25).join("; ")}. Offer more in that spirit (but not the same).`);
  if (input.passed.length) lines.push(`They swiped away: ${input.passed.slice(0, 25).join("; ")}. Fewer ideas like these.`);
  if (input.exclude.length) lines.push(`Exclude list (already seen or on their list): ${input.exclude.slice(0, 200).join("; ")}.`);
  return lines.join("\n");
}

// --- Checking Claude's answer ---------------------------------------------------------------------

export type RawDeckCard = {
  title: string;
  description: string;
  emoji: string | null;
  size: string;
  cost_eur: number | null;
  location: string | null;
  setting: string;
  theme: string | null;
  wildcard: boolean;
  event_index: number | null;
  best_season?: string | null;
  motif?: string | null;
  quips?: Partial<CardQuips> | null;
};

export type CardDraft = {
  kind: "idea" | "combo";
  title: string;
  note: string | null;
  emoji: string | null;
  size: IdeaSize;
  costEur: number | null;
  location: string | null;
  setting: PlaceSetting | null;
  theme: string | null;
  wildcard: boolean;
  bestSeason: SeasonKey | null;
  dedupeKey: string;
  /** Index into the events given to the prompt (combo cards). */
  eventIndex: number | null;
  motif: Motif | null;
  quips: CardQuips | null;
};

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const THEME_KEYS = new Set<string>(DECK_THEMES.map((t) => t.key));

/** Sane values, no near-duplicates (of each other or of anything seen before), each event once. */
export function cleanDeckCards(raw: RawDeckCard[], params: { existingKeys: string[]; eventCount: number; maxCombos: number }): CardDraft[] {
  const keys = [...params.existingKeys];
  const usedEvents = new Set<number>();
  const result: CardDraft[] = [];
  for (const item of raw) {
    const title = clip(item.title, 80);
    if (!title) continue;
    const key = dedupeKey(title);
    if (!key || isNearDuplicate(key, keys)) continue;
    let eventIndex: number | null = null;
    if (typeof item.event_index === "number" && Number.isInteger(item.event_index)) {
      const index = item.event_index;
      if (index < 0 || index >= params.eventCount || usedEvents.has(index) || usedEvents.size >= params.maxCombos) continue;
      eventIndex = index;
      usedEvents.add(index);
    }
    keys.push(key);
    const cost = typeof item.cost_eur === "number" && Number.isFinite(item.cost_eur) ? Math.min(10_000, Math.max(0, Math.round(item.cost_eur))) : null;
    const emoji = clip(item.emoji, 8);
    const art = cleanCardArt(item);
    result.push({
      kind: eventIndex === null ? "idea" : "combo",
      title,
      note: clip(item.description, 400),
      emoji: emoji && /\p{Extended_Pictographic}/u.test(emoji) ? emoji : null,
      size: item.size === "large" ? "large" : "small",
      costEur: cost,
      location: clip(item.location, 120),
      setting: item.setting === "indoor" ? "indoor" : item.setting === "outdoor" ? "outdoor" : null,
      theme: item.theme && THEME_KEYS.has(item.theme) ? item.theme : null,
      wildcard: item.wildcard === true,
      bestSeason: (SEASON_KEYS as readonly string[]).includes(item.best_season ?? "") ? (item.best_season as SeasonKey) : null,
      dedupeKey: key,
      eventIndex,
      ...art,
    });
  }
  return result;
}

// --- Swiping -----------------------------------------------------------------------------------

export type SwipeOutcome = "match" | "pass" | "wait" | "keep" | "archive";

/** What a swipe means for the card, given what the partner said (if anything). */
export function swipeOutcome(mine: SwipeVerdict, partner: SwipeVerdict | null): SwipeOutcome {
  if (mine === "nope") return "pass";
  if (mine === "maybe") return "wait";
  return partner === "like" || partner === "super" ? "match" : "wait";
}

export type DeckCardView = {
  id: string;
  kind: DeckCardKind;
  title: string;
  note: string | null;
  emoji: string | null;
  size: IdeaSize;
  costEur: number | null;
  location: string | null;
  setting: PlaceSetting | null;
  theme: string | null;
  wildcard: boolean;
  event: { title: string; startsAt: string; endsAt: string | null; allDay: boolean; venue: string | null; url: string | null; when: string } | null;
  /** The partner super-liked it (shown with a star and a name). */
  partnerSuper: boolean;
  /** Both are free at the event time (combo cards; null = unknown). */
  bothFree?: boolean | null;
  /** Revisit cards: "seit März" (how long the idea has waited). */
  waitingSince?: string | null;
  /** Picture strip and the flower's quips (stored, or the fallback). */
  art: CardArt;
  /** "Sorte: Gemütlich" – the category's name. */
  sorte: string;
  /** The day on the card: the event's, or the next free evening (set by the page; null = unknown). */
  when?: CardWhen | null;
};

type CardForOrder = { id: string; createdAt: Date; eventStartsAt: Date | null; kind?: DeckCardKind };

/**
 * The order one person sees: the partner's super-likes first, then cards the
 * partner liked (a match is one swipe away – without saying so), then old
 * wishlist ideas ("noch Lust?"), then combos by event date, then the rest oldest first.
 */
export function orderDeck<T extends CardForOrder>(cards: T[], partnerVerdicts: Map<string, SwipeVerdict>): T[] {
  const rank = (c: T) => {
    const v = partnerVerdicts.get(c.id);
    return v === "super" ? 0 : v === "like" ? 1 : c.kind === "revisit" ? 2 : c.eventStartsAt ? 3 : 4;
  };
  return [...cards].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.eventStartsAt && b.eventStartsAt) return a.eventStartsAt.getTime() - b.eventStartsAt.getTime();
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  });
}

/** A card's category: its theme, a guess from the words, events for combos. */
export function cardCategory(card: Pick<DeckCardView, "theme" | "title" | "note" | "kind">): IdeaCategory {
  return categoryFromTheme(card.theme) ?? (card.kind === "combo" ? "events" : inferCategory(card.title, card.note) ?? "other");
}

export function matchesFilter(card: Pick<DeckCardView, "costEur" | "setting" | "size" | "theme" | "title" | "note" | "kind">, filter: IdeaFilter): boolean {
  return matchesIdeaFilter({ size: card.size, costEur: card.costEur, setting: card.setting, category: cardCategory(card) }, filter);
}

/** How many hand-picked Köln ideas go into each batch (all of them, a few at a time, without the AI). */
export const CURATED_PER_BATCH = 3;

/** Köln ideas as swipe cards: the ones that are not in the deck, on the wishlist or done yet. */
export function curatedForDeck(curated: readonly CuratedIdea[], existingKeys: string[], count: number): CardDraft[] {
  const keys = [...existingKeys];
  const result: CardDraft[] = [];
  for (const idea of curated) {
    if (result.length >= count) break;
    const key = dedupeKey(idea.title);
    if (isNearDuplicate(key, keys)) continue;
    keys.push(key);
    result.push({
      kind: "idea",
      title: idea.title,
      note: idea.note,
      emoji: "📍",
      size: idea.size,
      costEur: idea.costEur,
      location: idea.location,
      setting: idea.setting,
      theme: idea.costEur === 0 ? "free" : null,
      wildcard: false,
      bestSeason: null,
      dedupeKey: key,
      eventIndex: null,
      // Look and quips come from the fallback (core/card-art.ts).
      motif: null,
      quips: null,
    });
  }
  return result;
}

/** One super-like per person and day (Berlin). */
export function superLikeLeft(lastSuperAt: Date | null, now: Date, zone = APP_TIMEZONE): boolean {
  if (!lastSuperAt) return true;
  return DateTime.fromJSDate(lastSuperAt, { zone }).toISODate() !== DateTime.fromJSDate(now, { zone }).toISODate();
}

/** Should a new batch be made now? */
export function needsRefill(params: { remainingPerPerson: number[]; openTotal: number; autoBatchesToday: number }): boolean {
  if (params.autoBatchesToday >= DECK_AUTO_BATCHES_PER_DAY) return false;
  if (params.openTotal >= DECK_MAX_OPEN) return false;
  return params.remainingPerPerson.some((n) => n < DECK_REFILL_BELOW);
}

/** "Sam hat 4 Ideen geliked" – once a day, from 3 waiting likes on, not during quiet hours (the caller checks). */
export const NUDGE_MIN_LIKES = 3;

// --- "Vielleicht" and old wishlist ideas ------------------------------------------------------------

const SEASON_START: Record<Exclude<SeasonKey, "any">, number> = { spring: 3, summer: 6, autumn: 9, winter: 12 };
/** A "maybe" without a better season comes back after this many days. */
export const MAYBE_DAYS = 21;

/** When a "maybe" card comes back: at the start of its best season, else in three weeks. */
export function maybeRevisitAt(bestSeason: SeasonKey | null, now: Date, zone = APP_TIMEZONE): Date {
  const today = DateTime.fromJSDate(now, { zone });
  const current = seasonOf(now, zone).en;
  if (!bestSeason || bestSeason === "any" || bestSeason === current) return today.plus({ days: MAYBE_DAYS }).startOf("day").set({ hour: 8 }).toJSDate();
  const month = SEASON_START[bestSeason];
  let start = today.set({ month, day: 1, hour: 8, minute: 0, second: 0, millisecond: 0 });
  if (start <= today) start = start.plus({ years: 1 });
  return start.toJSDate();
}

/** Ideas waiting this long on the wishlist come back as a card ("noch Lust?"). */
export const REVISIT_AFTER_DAYS = 90;

/**
 * Revisit cards: one 💚 keeps the idea (fresh again), two ✕ remove it from the
 * wishlist, a single ✕ waits for the other.
 */
export function revisitOutcome(mine: SwipeVerdict, partner: SwipeVerdict | null): SwipeOutcome {
  if (mine === "like" || mine === "super") return "keep";
  if (mine === "maybe") return "wait";
  return partner === "nope" ? "archive" : "wait";
}
