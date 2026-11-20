import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isUniqueEnrollmentViolation } from "../packages";

describe("packages enrollment uniqueness", () => {
  it("detects PostgreSQL unique violations for the enrollment index", () => {
    expect(isUniqueEnrollmentViolation({ code: "23505" })).toBe(true);
    expect(isUniqueEnrollmentViolation({ code: "23503" })).toBe(false);
    expect(isUniqueEnrollmentViolation(new Error("boom"))).toBe(false);
  });

  it("keeps the partial unique index migration isolated", () => {
    const migrationPath = path.resolve(process.cwd(), "../../lib/db/migrations/0059_active_enrollment_unique_index.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE UNIQUE INDEX "patient_packages_unique_active_patient_program_clinic"');
    expect(sql).toContain('ON "patient_packages" ("patient_id", "package_id", "clinic_id")');
    expect(sql).toContain('WHERE "status" = \'active\'');
  });
});
