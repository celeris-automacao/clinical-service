CREATE TABLE "community_notification_mutes" (
	"user_id" integer NOT NULL,
	"clinic_id" integer NOT NULL,
	CONSTRAINT "community_notification_mutes_user_clinic_unique" UNIQUE("user_id","clinic_id")
);
--> statement-breakpoint
ALTER TABLE "community_notification_mutes" ADD CONSTRAINT "community_notification_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notification_mutes" ADD CONSTRAINT "community_notification_mutes_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "mute_community_notifications";