CREATE TABLE "special_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"month" smallint NOT NULL,
	"day" smallint NOT NULL,
	"year" smallint,
	"person_id" uuid,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_cards" ADD COLUMN "best_season" text;--> statement-breakpoint
ALTER TABLE "deck_swipes" ADD COLUMN "revisit_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "special_days" ADD CONSTRAINT "special_days_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_days" ADD CONSTRAINT "special_days_person_id_users_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "special_days" ADD CONSTRAINT "special_days_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "special_days_couple_idx" ON "special_days" USING btree ("couple_id");