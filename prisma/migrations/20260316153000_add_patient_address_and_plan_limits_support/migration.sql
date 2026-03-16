ALTER TABLE "clinical"."patients"
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "document" TEXT;

CREATE TABLE "clinical"."patient_addresses" (
    "patient_id" UUID NOT NULL,
    "zip_code" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'BR',

    CONSTRAINT "patient_addresses_pkey" PRIMARY KEY ("patient_id")
);

ALTER TABLE "clinical"."patient_addresses"
ADD CONSTRAINT "patient_addresses_patient_id_fkey"
FOREIGN KEY ("patient_id") REFERENCES "clinical"."patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
