ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rg" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birth_date" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_cpf_unique'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_cpf_unique" UNIQUE("cpf");
  END IF;
END $$;