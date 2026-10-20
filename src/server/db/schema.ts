// Database schema (Drizzle ORM). Column names are camelCase here and
// snake_case in Postgres (`casing: "snake_case"`).
//
// The full V1 model is defined up front so later milestones only add code.
// V2 adds reviews and photos after a date (date_reviews, date_photos).

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { IDEA_CATEGORIES } from "@/core/categories";
import {
  AI_REQUEST_KINDS,
  CONNECTION_STATUSES,
  CYCLE_STATUSES,
  DATE_STATUSES,
  DECK_CARD_KINDS,
  DECK_CARD_STATUSES,
  EVENT_KINDS,
  EVENT_MIXES,
  EXTRAS,
  SOURCE_PAGE_ORIGINS,
  EVENT_SOURCE_KINDS,
  FETCH_STATUSES,
  IDEA_SIZES,
  IDEA_SOURCES,
  NOTIFICATION_TYPES,
  PLACE_SETTINGS,
  PLAN_MODES,
  SEASON_KEYS,
  SPECIAL_DAY_KINDS,
  RHYTHMS,
  SUGGESTION_STATUSES,
  SWIPE_VERDICTS,
  SYNC_STATUSES,
  USER_COLORS,
  AGAIN_ANSWERS,
  FLOWER_POTS,
} from "@/lib/domain";

const timestamptz = () => timestamp({ withTimezone: true });
const createdAt = () => timestamptz().notNull().defaultNow();
const updatedAt = () =>
  timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// --- Couple & users ---------------------------------------------------------

export const couples = pgTable("couples", {
  id: uuid().primaryKey().defaultRandom(),
  // Set while the couple waits for its second member, cleared on join.
  inviteCode: text().unique("couples_invite_code_unique"),
  inviteExpiresAt: timestamptz(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid().references(() => couples.id, { onDelete: "set null" }),
    googleSub: text().notNull().unique("users_google_sub_unique"),
    email: text().notNull().unique("users_email_unique"),
    name: text().notNull(),
    avatarUrl: text(),
    color: text({ enum: USER_COLORS }),
    createdAt: createdAt(),
    lastLoginAt: timestamptz(),
    // Set once the person has seen the short introduction after pairing.
    onboardedAt: timestamptz(),
    // Where this person usually starts from (for the route link), e.g. "Ehrenfeld".
    startLocation: text(),
    // SHA-256 of the personal key for the iPhone share shortcut (POST /api/share).
    shareTokenHash: text().unique("users_share_token_hash_unique"),
  },
  (t) => [index("users_couple_idx").on(t.coupleId)],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie value – the raw token is never stored.
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// Google Calendar access (milestone 3). Tokens are AES-256-GCM encrypted.
export const googleConnections = pgTable("google_connections", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  refreshTokenEnc: text().notNull(),
  accessTokenEnc: text(),
  accessTokenExpiresAt: timestamptz(),
  scopes: text().array().notNull().default([]),
  // Calendars whose busy times count for the slot finder.
  busyCalendarIds: text().array().notNull().default(["primary"]),
  status: text({ enum: CONNECTION_STATUSES }).notNull().default("ok"),
  connectedAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Settings -----------------------------------------------------------------
// Times of day are stored as minutes after midnight (Europe/Berlin), e.g. 600 = 10:00.

export const coupleSettings = pgTable("couple_settings", {
  coupleId: uuid()
    .primaryKey()
    .references(() => couples.id, { onDelete: "cascade" }),
  rhythm: text({ enum: RHYTHMS }).notNull().default("weekly"),
  mode: text({ enum: PLAN_MODES }).notNull().default("alternating"),
  firstPlannerId: uuid().references(() => users.id, { onDelete: "set null" }),
  deadlineDaysBeforeEnd: smallint().notNull().default(3),
  deadlineMinute: smallint().notNull().default(20 * 60),
  smallDurationMinutes: smallint().notNull().default(120),
  smallStartFromMinute: smallint().notNull().default(10 * 60),
  smallStartUntilMinute: smallint().notNull().default(21 * 60),
  largeMinDurationMinutes: smallint().notNull().default(300),
  largeMaxDurationMinutes: smallint().notNull().default(540),
  largeStartFromMinute: smallint().notNull().default(9 * 60),
  largeStartUntilMinute: smallint().notNull().default(13 * 60),
  latestEndMinute: smallint().notNull().default(23 * 60),
  minLeadHours: smallint().notNull().default(12),
  bufferMinutes: smallint().notNull().default(30),
  horizonDays: smallint().notNull().default(14),
  quietHoursStartMinute: smallint().notNull().default(22 * 60),
  quietHoursEndMinute: smallint().notNull().default(8 * 60),
  // Dev clock (only used when ENABLE_DEV_TOOLS=1): shifts "now" to test many rounds.
  devClockOffsetMinutes: integer().notNull().default(0),
  // Swipe deck: share of event combos per batch, and a claim while a batch is being made.
  deckEventMix: text({ enum: EVENT_MIXES }).notNull().default("some"),
  // Extras switched off in the settings (EXTRAS in domain.ts).
  hiddenExtras: text({ enum: EXTRAS }).array().notNull().default([]),
  deckRefillStartedAt: timestamptz(),
  // Monthly date budget in euros (null = none) and the first month it counted ("2026-10").
  monthlyBudgetEur: integer(),
  budgetSinceMonth: text(),
  // The flower on the Beet (Garten): its name and the pot you chose (only unlocked pots show).
  flowerName: text().notNull().default("Rosi"),
  flowerPot: text({ enum: FLOWER_POTS }).notNull().default("terrakotta"),
  updatedAt: updatedAt(),
});

// --- Wishlist -----------------------------------------------------------------

export const ideas = pgTable(
  "ideas",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    title: text().notNull(),
    size: text({ enum: IDEA_SIZES }).notNull(),
    note: text(),
    url: text(),
    costEur: integer(),
    location: text(),
    // Drinnen / draußen: outdoor ideas get daylight and weather in the free times. Null = unknown.
    setting: text({ enum: PLACE_SETTINGS }),
    // Essen, Natur, Kultur … – when empty the wishlist guesses from title and note (core/categories.ts).
    category: text({ enum: IDEA_CATEGORIES }),
    source: text({ enum: IDEA_SOURCES }).notNull().default("wishlist"),
    // V2: id of the idea in an external source (curated list, AI run)
    externalRef: text(),
    createdById: uuid().references(() => users.id, { onDelete: "set null" }),
    updatedById: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: timestamptz(),
  },
  (t) => [index("ideas_couple_idx").on(t.coupleId)],
);

// --- Cycles & dates -------------------------------------------------------------

export const cycles = pgTable(
  "cycles",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    seq: integer().notNull(),
    startsAt: timestamptz().notNull(),
    endsAt: timestamptz().notNull(),
    deadlineAt: timestamptz().notNull(),
    mode: text({ enum: PLAN_MODES }).notNull(),
    // Whose turn it is. Null in suggestion mode.
    plannerId: uuid().references(() => users.id, { onDelete: "set null" }),
    status: text({ enum: CYCLE_STATUSES }).notNull().default("open"),
    closedAt: timestamptz(),
    createdAt: createdAt(),
  },
  (t) => [unique("cycles_couple_seq_unique").on(t.coupleId, t.seq)],
);

export const datePlans = pgTable(
  "date_plans",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    cycleId: uuid()
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    ideaId: uuid().references(() => ideas.id, { onDelete: "set null" }),
    // Snapshot of the idea at planning time (or the spontaneous idea).
    title: text().notNull(),
    size: text({ enum: IDEA_SIZES }).notNull(),
    location: text(),
    note: text(),
    url: text(),
    startsAt: timestamptz().notNull(),
    endsAt: timestamptz().notNull(),
    organizerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text({ enum: DATE_STATUSES }).notNull().default("planned"),
    // Who chose the current time – the other person confirms ("Passt!").
    proposedById: uuid().references(() => users.id, { onDelete: "set null" }),
    confirmedById: uuid().references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamptz(),
    cancelledAt: timestamptz(),
    // Google Calendar sync (milestone 5)
    googleEventId: text(),
    googleCalendarId: text().notNull().default("primary"),
    syncStatus: text({ enum: SYNC_STATUSES }).notNull().default("pending"),
    syncError: text(),
    syncAttempts: smallint().notNull().default(0),
    // Budget: the estimate when planning (idea / event price), the real amount after the date.
    estimatedCostEur: integer(),
    actualCostEur: integer(),
    // Paid from the savings pot instead of the month budget.
    fromPot: boolean().notNull().default(false),
    // Surprise: the partner only sees time and the hint until the day itself.
    surprise: boolean().notNull().default(false),
    surpriseHint: text(),
    surpriseRevealedAt: timestamptz(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("date_plans_cycle_idx").on(t.cycleId),
    index("date_plans_couple_starts_idx").on(t.coupleId, t.startsAt),
  ],
);

// Preparation checklist of a date ("Tisch reservieren", "Tickets kaufen").
export const dateTasks = pgTable(
  "date_tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    dateId: uuid()
      .notNull()
      .references(() => datePlans.id, { onDelete: "cascade" }),
    title: text().notNull(),
    doneAt: timestamptz(),
    createdById: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("date_tasks_date_idx").on(t.dateId)],
);

// Review after the date: one per person, so each says how it was for them.
export const dateReviews = pgTable(
  "date_reviews",
  {
    id: uuid().primaryKey().defaultRandom(),
    dateId: uuid()
      .notNull()
      .references(() => datePlans.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: smallint().notNull(),
    note: text(),
    /** "Nochmal machen?" – nö / vielleicht / unbedingt (null = not answered). */
    again: text({ enum: AGAIN_ANSWERS }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("date_reviews_date_user_unique").on(t.dateId, t.userId)],
);

// Photos of a date. The files live in a private store (Vercel Blob), only the path is here.
export const datePhotos = pgTable(
  "date_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    dateId: uuid()
      .notNull()
      .references(() => datePlans.id, { onDelete: "cascade" }),
    uploadedById: uuid().references(() => users.id, { onDelete: "set null" }),
    // Storage paths of the full image and the thumbnail.
    fullPath: text().notNull(),
    thumbPath: text().notNull(),
    width: smallint().notNull(),
    height: smallint().notNull(),
    bytes: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("date_photos_date_idx").on(t.dateId)],
);

// Suggestion mode: proposals generated by the app, so rejected ones are not repeated.
export const suggestions = pgTable(
  "suggestions",
  {
    id: uuid().primaryKey().defaultRandom(),
    cycleId: uuid()
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    size: text({ enum: IDEA_SIZES }).notNull(),
    startsAt: timestamptz().notNull(),
    endsAt: timestamptz().notNull(),
    ideaId: uuid().references(() => ideas.id, { onDelete: "set null" }),
    status: text({ enum: SUGGESTION_STATUSES }).notNull().default("pending"),
    decidedById: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamptz(),
    createdAt: createdAt(),
  },
  (t) => [index("suggestions_cycle_idx").on(t.cycleId)],
);

// --- Event sources -----------------------------------------------------------------

// Websites the couple follows. The tick reads each one about once a day.
export const eventSources = pgTable(
  "event_sources",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    url: text().notNull(),
    label: text().notNull(),
    kind: text({ enum: EVENT_SOURCE_KINDS }).notNull().default("calendar"),
    createdById: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    // Set while a fetch runs, so the UI can show it and two runs do not overlap.
    fetchStartedAt: timestamptz(),
    lastFetchedAt: timestamptz(),
    lastStatus: text({ enum: FETCH_STATUSES }),
    lastError: text(),
    lastCount: smallint(),
    // sha256 of the text Claude last read: unchanged pages are not sent again.
    contentHash: text(),
    // When Claude picked the sub-pages (null = not yet – happens on the next read).
    pagesPickedAt: timestamptz(),
  },
  (t) => [unique("event_sources_couple_url_unique").on(t.coupleId, t.url)],
);

// Listing pages of a source that are read along with it ("Konzerte", "Wochenende" …):
// picked once by Claude, then removed or added by the couple.
export const eventSourcePages = pgTable(
  "event_source_pages",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceId: uuid()
      .notNull()
      .references(() => eventSources.id, { onDelete: "cascade" }),
    url: text().notNull(),
    label: text().notNull(),
    // "ai" = picked by Claude, "user" = added by hand
    addedBy: text({ enum: SOURCE_PAGE_ORIGINS }).notNull(),
    lastStatus: text({ enum: FETCH_STATUSES }),
    lastError: text(),
    lastCount: smallint(),
    createdAt: createdAt(),
  },
  (t) => [unique("event_source_pages_source_url_unique").on(t.sourceId, t.url)],
);
export type EventSourcePage = typeof eventSourcePages.$inferSelect;

// What was found on a source. Replaced as a whole on every successful fetch.
export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    sourceId: uuid()
      .notNull()
      .references(() => eventSources.id, { onDelete: "cascade" }),
    kind: text({ enum: EVENT_KINDS }).notNull(),
    title: text().notNull(),
    startsAt: timestamptz(),
    endsAt: timestamptz(),
    allDay: boolean().notNull().default(false),
    venue: text(),
    priceText: text(),
    url: text(),
    summary: text(),
    // Stable across fetches (title + start), e.g. to know a tip is already on the wishlist.
    dedupeKey: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("events_source_key_unique").on(t.sourceId, t.dedupeKey),
    index("events_couple_starts_idx").on(t.coupleId, t.startsAt),
  ],
);

// --- Budget ---------------------------------------------------------------------------------------

// One row per closed month: what was spent and how much is in the savings pot afterwards.
export const budgetMonths = pgTable(
  "budget_months",
  {
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    month: text().notNull(),
    budgetEur: integer().notNull(),
    spentEur: integer().notNull(),
    fromPotEur: integer().notNull(),
    dates: smallint().notNull(),
    potAfterEur: integer().notNull(),
    closedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.coupleId, t.month] })],
);

// --- Special days ---------------------------------------------------------------------------------

// Anniversary, birthdays …: every year on month/day. `year` (optional) gives "2. Jahrestag".
export const specialDays = pgTable(
  "special_days",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    kind: text({ enum: SPECIAL_DAY_KINDS }).notNull(),
    title: text().notNull(),
    month: smallint().notNull(),
    day: smallint().notNull(),
    year: smallint(),
    // Whose birthday it is (the other one gets the reminder).
    personId: uuid().references(() => users.id, { onDelete: "cascade" }),
    createdById: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("special_days_couple_idx").on(t.coupleId)],
);

// --- Swipe deck ("Entdecken") ----------------------------------------------------------

// Ideas Claude made for the couple. Never deleted while the couple exists, so
// nothing comes back: the dedupe key (normalized title) is unique per couple.
export const deckCards = pgTable(
  "deck_cards",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    kind: text({ enum: DECK_CARD_KINDS }).notNull(),
    title: text().notNull(),
    note: text(),
    size: text({ enum: IDEA_SIZES }).notNull(),
    costEur: integer(),
    location: text(),
    setting: text({ enum: PLACE_SETTINGS }),
    theme: text(),
    emoji: text(),
    // Deliberately outside their usual taste ("Mal was anderes").
    wildcard: boolean().notNull().default(false),
    // When it fits best – a "maybe" comes back then.
    bestSeason: text({ enum: SEASON_KEYS }),
    dedupeKey: text().notNull(),
    // Combo cards: a snapshot of the event (events are replaced on every fetch).
    eventTitle: text(),
    eventStartsAt: timestamptz(),
    eventEndsAt: timestamptz(),
    eventAllDay: boolean().notNull().default(false),
    eventVenue: text(),
    eventUrl: text(),
    eventKey: text(),
    status: text({ enum: DECK_CARD_STATUSES }).notNull().default("open"),
    matchedAt: timestamptz(),
    ideaId: uuid().references(() => ideas.id, { onDelete: "set null" }),
    // Running number of the batch (rotates the themes).
    batch: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("deck_cards_couple_key_unique").on(t.coupleId, t.dedupeKey), index("deck_cards_couple_status_idx").on(t.coupleId, t.status)],
);

// One swipe per person and card.
export const deckSwipes = pgTable(
  "deck_swipes",
  {
    cardId: uuid()
      .notNull()
      .references(() => deckCards.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verdict: text({ enum: SWIPE_VERDICTS }).notNull(),
    // "Vielleicht": the card comes back to this person from then on.
    revisitAt: timestamptz(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] }), index("deck_swipes_user_created_idx").on(t.userId, t.createdAt)],
);

// Small operational facts (e.g. when the cron tick last ran) for the "Läuft alles?" status.
export const appStatus = pgTable("app_status", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamptz().notNull().defaultNow(),
});

// One row per Claude call: daily limit for idea suggestions, and a record of token use.
export const aiRequests = pgTable(
  "ai_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    coupleId: uuid()
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    kind: text({ enum: AI_REQUEST_KINDS }).notNull(),
    model: text().notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("ai_requests_couple_created_idx").on(t.coupleId, t.createdAt)],
);

// --- Push notifications -------------------------------------------------------

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text().notNull().unique("push_subscriptions_endpoint_unique"),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
    lastSuccessAt: timestamptz(),
    failureCount: smallint().notNull().default(0),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text({ enum: NOTIFICATION_TYPES }).notNull(),
    enabled: boolean().notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.type] })],
);

// One row per sent reminder. The unique key makes the cron tick idempotent.
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text({ enum: NOTIFICATION_TYPES }).notNull(),
    refId: text().notNull(),
    dueAt: timestamptz().notNull(),
    sentAt: createdAt(),
  },
  (t) => [unique("notification_log_unique").on(t.userId, t.type, t.refId, t.dueAt)],
);

export type User = typeof users.$inferSelect;
export type Couple = typeof couples.$inferSelect;
export type CoupleSettings = typeof coupleSettings.$inferSelect;
export type Cycle = typeof cycles.$inferSelect;
export type DatePlan = typeof datePlans.$inferSelect;
export type EventSource = typeof eventSources.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type DatePhoto = typeof datePhotos.$inferSelect;
export type DateReview = typeof dateReviews.$inferSelect;
export type SuggestionRow = typeof suggestions.$inferSelect;
export type DeckCard = typeof deckCards.$inferSelect;
export type DeckSwipe = typeof deckSwipes.$inferSelect;
export type SpecialDay = typeof specialDays.$inferSelect;
export type DateTask = typeof dateTasks.$inferSelect;
