ALTER TABLE "audit_failures" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "audit_failures" ADD COLUMN "resolved_by" integer;--> statement-breakpoint
ALTER TABLE "audit_failures" ADD CONSTRAINT "audit_failures_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;