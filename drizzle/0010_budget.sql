CREATE TABLE "budget_months" (
	"couple_id" uuid NOT NULL,
	"month" text NOT NULL,
	"budget_eur" integer NOT NULL,
	"spent_eur" integer NOT NULL,
	"from_pot_eur" integer NOT NULL,
	"dates" smallint NOT NULL,
	"pot_after_eur" integer NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_months_couple_id_month_pk" PRIMARY KEY("couple_id","month")
);
--> statement-breakpoint
ALTER TABLE "couple_settings" ADD COLUMN "monthly_budget_eur" integer;--> statement-breakpoint
ALTER TABLE "couple_settings" ADD COLUMN "budget_since_month" text;--> statement-breakpoint
ALTER TABLE "date_plans" ADD COLUMN "estimated_cost_eur" integer;--> statement-breakpoint
ALTER TABLE "date_plans" ADD COLUMN "actual_cost_eur" integer;--> statement-breakpoint
ALTER TABLE "date_plans" ADD COLUMN "from_pot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_months" ADD CONSTRAINT "budget_months_couple_id_couples_id_fk" FOREIGN KEY ("couple_id") REFERENCES "public"."couples"("id") ON DELETE cascade ON UPDATE no action;