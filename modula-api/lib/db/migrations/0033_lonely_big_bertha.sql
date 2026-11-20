CREATE TYPE "public"."expense_category" AS ENUM('salario', 'agua', 'luz', 'telefone', 'internet', 'outro');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinic_id" integer NOT NULL,
	"category" "expense_category" DEFAULT 'outro' NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"period" text NOT NULL,
	"receipt_url" text,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doctors" ADD COLUMN "commission_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "amount_charged" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;