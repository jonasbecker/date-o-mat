CREATE TABLE "date_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "date_reviews_date_user_unique" UNIQUE("date_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "date_reviews" ADD CONSTRAINT "date_reviews_date_id_date_plans_id_fk" FOREIGN KEY ("date_id") REFERENCES "public"."date_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_reviews" ADD CONSTRAINT "date_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "date_plans" DROP COLUMN "rating";--> statement-breakpoint
ALTER TABLE "date_plans" DROP COLUMN "review_note";