CREATE TABLE "event_source_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"url" text NOT NULL,
	"label" text NOT NULL,
	"added_by" text NOT NULL,
	"last_status" text,
	"last_error" text,
	"last_count" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_source_pages_source_url_unique" UNIQUE("source_id","url")
);
--> statement-breakpoint
ALTER TABLE "event_sources" ADD COLUMN "pages_picked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_source_pages" ADD CONSTRAINT "event_source_pages_source_id_event_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."event_sources"("id") ON DELETE cascade ON UPDATE no action;