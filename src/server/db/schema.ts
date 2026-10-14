// Database schema (Drizzle ORM). Column names are camelCase here and
// snake_case in Postgres (`casing: "snake_case"`).
//
// The full V1 model is defined up front so later milestones only add code.
// V2 adds reviews and photos after a date (date_reviews, date_photos).

import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CONNECTION_STATUSES,
  CYCLE_STATUSES,
  DATE_STATUSES,
  EVENT_KINDS,
  EVENT_SOURCE_KINDS,
  FETCH_STATUSES,
  IDEA_SIZES,
  IDEA_SOURCES,
  NOTIFICATION_TYPES,
  PLAN_MODES,
  RHYTHMS,
  SUGGESTION_STATUSES,
  SYNC_STATUSES,
  USER_COLORS,
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("date_plans_cycle_idx").on(t.cycleId),
    index("date_plans_couple_starts_idx").on(t.coupleId, t.startsAt),
  ],
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("date_reviews_date_user_unique").on(t.dateId, t.userId)],
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
  },
  (t) => [unique("event_sources_couple_url_unique").on(t.coupleId, t.url)],
);

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
export type DateReview = typeof dateReviews.$inferSelect;
export type SuggestionRow = typeof suggestions.$inferSelect;
