// Shared domain vocabulary. Safe to import from client and server code.
// Stored as plain text columns in Postgres (no DB enums), so adding a value
// later is a code change only – no migration needed.

export const APP_TIMEZONE = "Europe/Berlin";

export const USER_COLORS = ["mandarine", "himmel"] as const;
export type UserColor = (typeof USER_COLORS)[number];

export const IDEA_SIZES = ["small", "large"] as const;
export type IdeaSize = (typeof IDEA_SIZES)[number];

// Where an idea came from. V1 only writes "wishlist"; the other sources are
// reserved for curated ideas and AI suggestions (see README, "Erweiterungen").
export const IDEA_SOURCES = ["wishlist", "curated", "ai"] as const;
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
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CONNECTION_STATUSES = ["ok", "needs_reauth"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
