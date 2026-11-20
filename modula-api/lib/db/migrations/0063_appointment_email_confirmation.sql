ALTER TABLE "appointments"
  ADD COLUMN "confirmation_token_hash" text,
  ADD COLUMN "confirmation_sent_at" timestamp,
  ADD COLUMN "confirmed_at" timestamp;
