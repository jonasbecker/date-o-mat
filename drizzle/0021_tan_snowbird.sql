-- Older duplicates (both opened the Beet at once): keep the newest open suggestion per round.
UPDATE "suggestions" SET "status" = 'rejected' WHERE "status" = 'pending' AND "id" NOT IN (SELECT DISTINCT ON ("cycle_id") "id" FROM "suggestions" WHERE "status" = 'pending' ORDER BY "cycle_id", "created_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "suggestions_one_pending" ON "suggestions" USING btree ("cycle_id") WHERE "suggestions"."status" = 'pending';
