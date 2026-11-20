CREATE TABLE "audit_alert_cooldown" (
	"clinic_id" integer PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_alert_cooldown" ADD CONSTRAINT "audit_alert_cooldown_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;