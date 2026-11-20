import { pgTable, serial, text, timestamp, integer, primaryKey, unique } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const clinicsTable = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#16a34a"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientClinicsTable = pgTable(
  "patient_clinics",
  {
    patientId: integer("patient_id")
      .notNull()
      .references(() => patientsTable.id, { onDelete: "cascade" }),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.clinicId] })]
);

export const clinicOwnersTable = pgTable(
  "clinic_owners",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    clinicId: integer("clinic_id")
      .notNull()
      .references(() => clinicsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.clinicId] }),
  ]
);

export type Clinic = typeof clinicsTable.$inferSelect;
export type PatientClinic = typeof patientClinicsTable.$inferSelect;
export type ClinicOwner = typeof clinicOwnersTable.$inferSelect;
