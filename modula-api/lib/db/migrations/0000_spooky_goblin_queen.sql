CREATE TYPE "public"."user_role" AS ENUM('patient', 'profissional_saude', 'clinic_owner');--> statement-breakpoint
CREATE TYPE "public"."doctor_specialty" AS ENUM('nutritionist', 'psychologist', 'endocrinologist', 'general', 'other');--> statement-breakpoint
CREATE TYPE "public"."xp_reason" AS ENUM('exercise', 'water', 'nutrition', 'weekly_bonus', 'monthly_bonus');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('video', 'pdf', 'prescription', 'meal_plan', 'other');--> statement-breakpoint
CREATE TYPE "public"."clinic_plan" AS ENUM('basic', 'pro', 'professional', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."meal_label" AS ENUM('breakfast', 'lunch', 'dinner', 'snack', 'other');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'patient' NOT NULL,
	"avatar_url" text,
	"password_hash" text,
	"is_temporary_password" boolean DEFAULT false,
	"access_token" text,
	"apple_user_id" text,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "users_apple_user_id_unique" UNIQUE("apple_user_id")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"start_weight" numeric(5, 2) NOT NULL,
	"target_weight" numeric(5, 2),
	"date_of_birth" date,
	"daily_calorie_goal" integer,
	"protein_goal_g" integer,
	"carb_goal_g" integer,
	"fat_goal_g" integer,
	"meals_per_day" integer,
	"dietary_restrictions" text,
	"nutrition_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"specialty" "doctor_specialty" DEFAULT 'general' NOT NULL,
	"bio" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_doctors" (
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"date" date NOT NULL,
	"did_exercise" boolean DEFAULT false NOT NULL,
	"drank_water" boolean DEFAULT false NOT NULL,
	"ate_well" boolean DEFAULT false NOT NULL,
	"note" text,
	"photo_url" text,
	"food_photo_url" text,
	"exercise_photo_url" text,
	"food_calorie_estimate" integer,
	"exercise_description" text,
	"exercise_calorie_estimate" integer,
	"xp_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"date" date NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL,
	"note" text,
	"photo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sabotage_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"what_happened" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"points" integer NOT NULL,
	"reason" "xp_reason" NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"type" "material_type" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"file_url" text,
	"external_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinic_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan" "clinic_plan" DEFAULT 'basic' NOT NULL,
	"clinic_name" text,
	"logo_url" text,
	"sender_name" text,
	"from_email" text,
	"reply_to_email" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calorie_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"date" date NOT NULL,
	"meal_label" "meal_label" DEFAULT 'other',
	"photo_url" text,
	"calories" integer NOT NULL,
	"ai_description" text,
	"protein_g" integer,
	"carb_g" integer,
	"fat_g" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_patient_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"patient_id" integer NOT NULL,
	"generated_by" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	"summary_text" text NOT NULL,
	"doctor_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_doctors" ADD CONSTRAINT "patient_doctors_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_doctors" ADD CONSTRAINT "patient_doctors_doctor_id_doctors_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sabotage_notes" ADD CONSTRAINT "sabotage_notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_entries" ADD CONSTRAINT "xp_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_materials" ADD CONSTRAINT "patient_materials_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_materials" ADD CONSTRAINT "patient_materials_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calorie_entries" ADD CONSTRAINT "calorie_entries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_patient_summaries" ADD CONSTRAINT "ai_patient_summaries_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_patient_summaries" ADD CONSTRAINT "ai_patient_summaries_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_events" ADD CONSTRAINT "staff_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;