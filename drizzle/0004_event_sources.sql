CREATE TABLE "event_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"url" text NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'calendar' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetch_started_at" timestamp with time zone,
	"last_fetched_at" timestamp with time zone,
	"last_status" text,
	"last_error" text,
	"last_count" smallint,
	CONSTRAINT "event_sources_couple_url_unique" UNIQUE("couple_id","url")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"venue" text,
	"price_text" text,
	"url" text,
	"summary" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_key_unique" UNIQUE("source_id","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_id_event_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."event_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_couple_starts_idx" ON "events" USING btree ("couple_id","starts_at");