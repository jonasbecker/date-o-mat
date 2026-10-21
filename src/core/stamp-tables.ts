// Which tables the couple's fingerprint (server/stamp.ts) covers, and how each one belongs to the couple.
// Every table of the schema is either here or in NOT_STAMPED with a reason – stamp-tables.test.ts checks it, so
// a new table cannot be forgotten (its changes would then not show up by themselves).

/** How a table's rows belong to the couple: via one of the two people, the couple, its dates, rounds or event sources. */
export type StampScope = "people" | "couple" | "dates" | "cycles" | "sources" | "status";

export const STAMPED = {
  users: "people",
  google_connections: "people",
  push_subscriptions: "people",
  notification_prefs: "people",
  deck_swipes: "people",
  ideas: "couple",
  cycles: "couple",
  date_plans: "couple",
  date_photos: "couple",
  event_sources: "couple",
  events: "couple",
  budget_months: "couple",
  special_days: "couple",
  deck_cards: "couple",
  date_tasks: "dates",
  date_reviews: "dates",
  suggestions: "cycles",
  event_source_pages: "sources",
  // All rows but the errors (server and phone): a page that keeps failing must not refresh itself in a loop.
  app_status: "status",
} as const satisfies Record<string, StampScope>;

export const NOT_STAMPED: Record<string, string> = {
  couple_settings: "stamped on its own – the deck refill's start time is bookkeeping",
  couples: "only the invite code, shown while pairing",
  sessions: "logins, nothing a page shows",
  ai_requests: "usage counters, changing with every AI call",
  notification_log: "what was sent when, written by the cron",
};
