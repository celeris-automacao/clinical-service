ALTER TABLE "doctors" ALTER COLUMN "specialty" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "specialty" TYPE text USING "specialty"::text;--> statement-breakpoint
ALTER TABLE "doctors" ALTER COLUMN "specialty" SET DEFAULT 'general';--> statement-breakpoint
DROP TYPE "public"."doctor_specialty";
