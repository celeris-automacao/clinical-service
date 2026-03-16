CREATE TABLE "clinical"."task_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" TEXT NOT NULL,
    "xp_reward" INTEGER NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinical"."task_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "assigned_by_user_id" UUID NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_templates_tenant_id_title_task_type_key"
ON "clinical"."task_templates"("tenant_id", "title", "task_type");

ALTER TABLE "clinical"."task_templates"
ADD CONSTRAINT "task_templates_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinical"."task_assignments"
ADD CONSTRAINT "task_assignments_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "access"."tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinical"."task_assignments"
ADD CONSTRAINT "task_assignments_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "clinical"."task_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinical"."task_assignments"
ADD CONSTRAINT "task_assignments_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "clinical"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
