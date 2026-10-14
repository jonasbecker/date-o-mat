// The swipe deck ("Entdecken"): Claude makes batches of date ideas, each
// person swipes on their own, and a card becomes a wishlist idea only when
// both like it. Pure – the server stores cards and swipes and calls Claude.

import { DateTime } from "luxon";
import { APP_TIMEZONE, type EventMix, type IdeaSize, type PlaceSetting, type SwipeVerdict } from "@/lib/domain";

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

/** What the person picked in the filter, so "Mehr davon" makes matching cards. */
export const DECK_FILTERS = ["all", "cheap", "indoor", "outdoor", "short", "long", "events"] as const;
export type DeckFilter = (typeof DECK_FILTERS)[number];
export const DECK_FILTER_LABEL: Record<DeckFilter, string> = {
  all: "Alle",
  cheap: "💸 Günstig",
  indoor: "🏠 Drinnen",
  outdoor: "🌳 Draußen",
  short: "☕ Kurz",
  long: "🎡 Lang",
  events: "🎟️ Mit Event",
};
const FILTER_PROMPT: Record<Exclude<DeckFilter, "all" | "events">, string> = {
  cheap: "All ideas must be free or cheap (at most about 15 euros for both).",
  indoor: "All ideas must work indoors.",
  outdoor: "All ideas should be outdoors.",
  short: "All ideas must be small dates (up to about 3 hours).",
  long: "All ideas must be big dates (half a day or more).",
};

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
  /** Budget left this month in euros, if they set one (M18). */
  budgetLeft?: number | null;
  focus?: DeckFilter;
};

export const DECK_SYSTEM_PROMPT = [
  "You create date ideas for a young couple (students) in Cologne, Germany. They swipe through them like on a dating app.",
  "Every idea must be concrete and doable: say what they do and, if it helps, where (a real district, park, venue type or well-known place in or near Cologne).",
  "Do not invent specific events, dates, opening hours or prices. Rough cost estimates are fine.",
  "Write in German, casual and warm. title: max 60 characters, catchy. description: 1–2 sentences that make them want to go.",
  "emoji: one fitting emoji. size: \"small\" up to about 3 hours, \"large\" half a day or more. cost_eur: rough total for both (0 if free). setting: indoor or outdoor.",
  "theme: one of the given theme keys. wildcard: true for ideas that are deliberately different from their usual taste.",
  "Combo cards build on one of the listed real events: event_index is its number, the idea adds something that fits before or after (e.g. dinner nearby, a walk, a drink). For normal ideas event_index is null.",
  "Never repeat an idea from the exclude list, not even reworded.",
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
  if (input.focus && input.focus !== "all" && input.focus !== "events") lines.push(FILTER_PROMPT[input.focus]);
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
  dedupeKey: string;
  /** Index into the events given to the prompt (combo cards). */
  eventIndex: number | null;
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
      dedupeKey: key,
      eventIndex,
    });
  }
  return result;
}

// --- Swiping -----------------------------------------------------------------------------------

export type SwipeOutcome = "match" | "pass" | "wait";

/** What a swipe means for the card, given what the partner said (if anything). */
export function swipeOutcome(mine: SwipeVerdict, partner: SwipeVerdict | null): SwipeOutcome {
  if (mine === "nope") return "pass";
  if (mine === "maybe") return "wait";
  return partner === "like" || partner === "super" ? "match" : "wait";
}

export type DeckCardView = {
  id: string;
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
  event: { title: string; startsAt: string; endsAt: string | null; allDay: boolean; venue: string | null; url: string | null; when: string } | null;
  /** The partner super-liked it (shown with a star and a name). */
  partnerSuper: boolean;
  /** Both are free at the event time (combo cards; null = unknown). */
  bothFree?: boolean | null;
};

type CardForOrder = { id: string; createdAt: Date; eventStartsAt: Date | null };

/**
 * The order one person sees: the partner's super-likes first, then cards the
 * partner liked (a match is one swipe away – without saying so), then combos
 * by event date, then the rest oldest first.
 */
export function orderDeck<T extends CardForOrder>(cards: T[], partnerVerdicts: Map<string, SwipeVerdict>): T[] {
  const rank = (c: T) => {
    const v = partnerVerdicts.get(c.id);
    return v === "super" ? 0 : v === "like" ? 1 : c.eventStartsAt ? 2 : 3;
  };
  return [...cards].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.eventStartsAt && b.eventStartsAt) return a.eventStartsAt.getTime() - b.eventStartsAt.getTime();
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
  });
}

export function matchesFilter(card: Pick<DeckCardView, "kind" | "costEur" | "setting" | "size">, filter: DeckFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "cheap":
      return card.costEur !== null && card.costEur <= 15;
    case "indoor":
      return card.setting === "indoor";
    case "outdoor":
      return card.setting === "outdoor";
    case "short":
      return card.size === "small";
    case "long":
      return card.size === "large";
    case "events":
      return card.kind === "combo";
  }
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
