ALTER TABLE "conversations" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "patient_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "doctor_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "clinic_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_doctor_unique" UNIQUE("patient_id","doctor_id");--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
