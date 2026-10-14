CREATE TABLE "date_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "date_plans" ADD COLUMN "surprise" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "date_plans" ADD COLUMN "surprise_hint" text;--> statement-breakpoint
ALTER TABLE "date_plans" ADD COLUMN "surprise_revealed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "start_location" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "share_token_hash" text;--> statement-breakpoint
ALTER TABLE "date_tasks" ADD CONSTRAINT "date_tasks_date_id_date_plans_id_fk" FOREIGN KEY ("date_id") REFERENCES "public"."date_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_tasks" ADD CONSTRAINT "date_tasks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "date_tasks_date_idx" ON "date_tasks" USING btree ("date_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_share_token_hash_unique" UNIQUE("share_token_hash");