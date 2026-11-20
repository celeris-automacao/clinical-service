CREATE TYPE "public"."weight_goal_status" AS ENUM('none', 'pending', 'validated', 'rejected');--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "proposed_target_weight" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_goal_status" "weight_goal_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_goal_validated_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "weight_goal_validated_at" timestamp;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_weight_goal_validated_by_user_id_users_id_fk" FOREIGN KEY ("weight_goal_validated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;