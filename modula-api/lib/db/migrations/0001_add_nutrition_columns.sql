ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "daily_calorie_goal" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "protein_goal_g" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "carb_goal_g" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "fat_goal_g" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "meals_per_day" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "dietary_restrictions" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "nutrition_notes" text;
