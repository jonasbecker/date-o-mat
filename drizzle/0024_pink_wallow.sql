ALTER TABLE "date_reviews" ALTER COLUMN "rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "wilt_reason" text;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "wilt_note" text;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "leaf_removed_at" timestamp with time zone;