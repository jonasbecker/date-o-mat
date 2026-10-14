CREATE TABLE "deck_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"size" text NOT NULL,
	"cost_eur" integer,
	"location" text,
	"setting" text,
	"theme" text,
	"emoji" text,
	"wildcard" boolean DEFAULT false NOT NULL,
	"dedupe_key" text NOT NULL,
	"event_title" text,
	"event_starts_at" timestamp with time zone,
	"event_ends_at" timestamp with time zone,
	"event_all_day" boolean DEFAULT false NOT NULL,
	"event_venue" text,
	"event_url" text,
	"event_key" text,
	"status" text DEFAULT 'open' NOT NULL,
	"matched_at" timestamp with time zone,
	"idea_id" uuid,
	"batch" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_cards_couple_key_unique" UNIQUE("couple_id","dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "deck_swipes" (
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deck_swipes_card_id_user_id_pk" PRIMARY KEY("card_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "couple_settings" ADD COLUMN "deck_event_mix" text DEFAULT 'some' NOT NULL;--> statement-breakpoint
ALTER TABLE "couple_settings" ADD COLUMN "deck_refill_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD CONSTRAINT "deck_cards_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_swipes" ADD CONSTRAINT "deck_swipes_card_id_deck_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."deck_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_swipes" ADD CONSTRAINT "deck_swipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deck_cards_couple_status_idx" ON "deck_cards" USING btree ("couple_id","status");--> statement-breakpoint
CREATE INDEX "deck_swipes_user_created_idx" ON "deck_swipes" USING btree ("user_id","created_at");