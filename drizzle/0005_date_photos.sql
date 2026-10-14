CREATE TABLE "date_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"couple_id" uuid NOT NULL,
	"date_id" uuid NOT NULL,
	"uploaded_by_id" uuid,
	"full_path" text NOT NULL,
	"thumb_path" text NOT NULL,
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "date_photos" ADD CONSTRAINT "date_photos_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_photos" ADD CONSTRAINT "date_photos_date_id_date_plans_id_fk" FOREIGN KEY ("date_id") REFERENCES "public"."date_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_photos" ADD CONSTRAINT "date_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "date_photos_date_idx" ON "date_photos" USING btree ("date_id");