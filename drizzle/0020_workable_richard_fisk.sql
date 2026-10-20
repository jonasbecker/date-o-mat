ALTER TABLE "deck_cards" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "deck_cards" ADD COLUMN "illustrations" text[];--> statement-breakpoint
ALTER TABLE "deck_cards" ADD COLUMN "quips" jsonb;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "illustrations" text[];--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "quips" jsonb;