ALTER TABLE "calorie_entries" ADD COLUMN IF NOT EXISTS "protein_g" integer;--> statement-breakpoint
ALTER TABLE "calorie_entries" ADD COLUMN IF NOT EXISTS "carb_g" integer;--> statement-breakpoint
ALTER TABLE "calorie_entries" ADD COLUMN IF NOT EXISTS "fat_g" integer;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "did_exercise" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "drank_water" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "ate_well" DROP NOT NULL;
