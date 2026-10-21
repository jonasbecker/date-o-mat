// Shared domain vocabulary. Safe to import from client and server code.
// Stored as plain text columns in Postgres (no DB enums), so adding a value
// later is a code change only – no migration needed.

export const APP_TIMEZONE = "Europe/Berlin";

export const USER_COLORS = ["mandarine", "himmel"] as const;
export type UserColor = (typeof USER_COLORS)[number];
/** The person colors as accents (DESIGN.md §2): himmel = blue, mandarine = rosé. */
export const PERSON_HEX: Record<UserColor, string> = { himmel: "#4D63E8", mandarine: "#E58FA6" };

/** The flower's pots (Setup, DESIGN-GARTEN.md §5.5); more unlock with lived dates (core/bloom.ts). */
export const FLOWER_POTS = ["terrakotta", "blau", "gelb"] as const;
export type FlowerPot = (typeof FLOWER_POTS)[number];
export const FLOWER_NAME_MAX = 20;

export const IDEA_SIZES = ["small", "large"] as const;
export type IdeaSize = (typeof IDEA_SIZES)[number];

// Where an idea came from: typed in, curated list, AI suggestion, a tip
// found on an event source ("web"), or a match in the swipe deck ("deck").
export const IDEA_SOURCES = ["wishlist", "curated", "ai", "web", "deck"] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export const RHYTHMS = ["weekly", "biweekly", "semimonthly", "monthly"] as const;
export type Rhythm = (typeof RHYTHMS)[number];

/** Recommended planning deadline (days before the round ends) per rhythm. */
export const DEFAULT_DEADLINE_DAYS: Record<Rhythm, number> = { weekly: 3, biweekly: 5, semimonthly: 5, monthly: 10 };

export const PLAN_MODES = ["alternating", "suggestion"] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

// UI: offen → geplant → bestätigt → stattgefunden (oder übersprungen)
export const CYCLE_STATUSES = ["open", "planned", "confirmed", "done", "skipped"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const DATE_STATUSES = ["planned", "confirmed", "cancelled", "done"] as const;
export type DateStatus = (typeof DATE_STATUSES)[number];

export const SYNC_STATUSES = ["pending", "synced", "error"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SUGGESTION_STATUSES = ["pending", "accepted", "rejected"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "turn_started",
  "deadline_soon",
  "partner_activity",
  "date_tomorrow",
  "date_soon",
  "review_due",
  // Something needs a person: a calendar connection was lost.
  "system",
  // Swipe deck: both liked an idea.
  "match",
  // Swipe deck: the partner liked ideas you have not seen yet, or super-liked one.
  "deck_nudge",
  // Month recap of the date budget and the savings pot.
  "budget",
  // Anniversary, birthdays and other special days coming up.
  "special_day",
  // "Eure Date-Story" of the year is ready (late December).
  "story",
  // Preparation checklist of a date: still open the day before.
  "prep",
  // "Anstupsen" on the Beet: the one waiting reminds the one with the watering can.
  "nudge",
  // Technical: the server hit an error (at most once a day) – for whoever looks after the app.
  "errors",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
/** Off until a person switches them on (all others are on by default). */
export const NOTIFICATIONS_OFF_BY_DEFAULT: readonly NotificationType[] = ["errors"];

export const CONNECTION_STATUSES = ["ok", "needs_reauth"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Review after a date: 1–5 hearts. */
export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const REVIEW_NOTE_MAX = 500;
/** "Nochmal machen?" after a date (MFoto): nö / vielleicht / unbedingt. */
export const AGAIN_ANSWERS = ["no", "maybe", "yes"] as const;
export type AgainAnswer = (typeof AGAIN_ANSWERS)[number];
export const AGAIN_LABEL: Record<AgainAnswer, string> = { no: "nö", maybe: "vielleicht", yes: "unbedingt" };

// Event sources (websites the couple follows): a calendar lists dated events,
// a tips page (magazine) lists ideas without a fixed date.
export const EVENT_SOURCE_KINDS = ["calendar", "tips"] as const;
export type EventSourceKind = (typeof EVENT_SOURCE_KINDS)[number];

export const FETCH_STATUSES = ["ok", "empty", "error"] as const;
/** Who added a sub-page of an event source. */
export const SOURCE_PAGE_ORIGINS = ["ai", "user"] as const;
export type SourcePageOrigin = (typeof SOURCE_PAGE_ORIGINS)[number];
export type FetchStatus = (typeof FETCH_STATUSES)[number];

export const EVENT_KINDS = ["event", "tip"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Photos after a date: resized in the browser, stored privately. */
export const PHOTO_LIMITS = { perDate: 24, fullEdge: 1600, thumbEdge: 480, maxBytes: 3 * 1024 * 1024 } as const;

export const AI_REQUEST_KINDS = ["ideas", "events", "links", "deck", "art"] as const;
export type AiRequestKind = (typeof AI_REQUEST_KINDS)[number];

// Swipe deck ("Entdecken"): cards made by Claude, each person swipes on their own.
// A card is matched when both like it, passed as soon as one says no.
// "revisit": an idea that has waited long on the wishlist – still wanted?
export const DECK_CARD_KINDS = ["idea", "combo", "revisit"] as const;
export type DeckCardKind = (typeof DECK_CARD_KINDS)[number];
export const DECK_CARD_STATUSES = ["open", "matched", "passed", "expired"] as const;
export type DeckCardStatus = (typeof DECK_CARD_STATUSES)[number];
export const SWIPE_VERDICTS = ["like", "super", "nope", "maybe"] as const;
export type SwipeVerdict = (typeof SWIPE_VERDICTS)[number];
export const PLACE_SETTINGS = ["indoor", "outdoor"] as const;
export type PlaceSetting = (typeof PLACE_SETTINGS)[number];
/** How many event combos go into a new batch. */
/** Extras you can switch off (Einstellungen → Extras); all on by default, each shows up only when it fits. */
export const EXTRAS = ["checklist", "cards", "surprise", "story"] as const;
export type Extra = (typeof EXTRAS)[number];

export const EVENT_MIXES = ["none", "some", "lots"] as const;
export type EventMix = (typeof EVENT_MIXES)[number];

/** Special days that come back every year. A birthday belongs to one of the two. */
export const SPECIAL_DAY_KINDS = ["anniversary", "birthday", "other"] as const;
export type SpecialDayKind = (typeof SPECIAL_DAY_KINDS)[number];
export const SEASON_KEYS = ["any", "spring", "summer", "autumn", "winter"] as const;
export type SeasonKey = (typeof SEASON_KEYS)[number];
