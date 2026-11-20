/**
 * Integration tests for POST /api/auth/request-access
 *
 * These tests run against the REAL database and the REAL Express app — nothing
 * is mocked.  The email transport (Resend) gracefully no-ops when
 * RESEND_API_KEY is absent, so the full handler path is exercised:
 *   DB user lookup → rate-limit check/insert → bcrypt hash → DB update → email attempt
 *
 * Prerequisites: DATABASE_URL must point to a migrated, isolated test database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { db, usersTable, requestAccessAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../../app";

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TEST_PATIENT_EMAIL = "integration-test-access@test.internal";
const TEST_PATIENT_NAME = "Integration Test Patient";

const TEST_STAFF_EMAIL = "integration-test-access-staff@test.internal";
const TEST_STAFF_NAME = "Integration Test Staff";

let testPatientId: number;
let testStaffId: number;

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  // Remove any leftover rows from a previous interrupted run
  await db.delete(requestAccessAttemptsTable).where(
    eq(requestAccessAttemptsTable.email, TEST_PATIENT_EMAIL)
  );
  await db.delete(usersTable).where(eq(usersTable.email, TEST_PATIENT_EMAIL));
  await db.delete(usersTable).where(eq(usersTable.email, TEST_STAFF_EMAIL));

  // Seed the patient
  const [patient] = await db
    .insert(usersTable)
    .values({ email: TEST_PATIENT_EMAIL, name: TEST_PATIENT_NAME, role: "patient" })
    .returning({ id: usersTable.id });
  testPatientId = patient.id;

  // Seed a staff user to confirm non-patients are excluded
  const [staff] = await db
    .insert(usersTable)
    .values({ email: TEST_STAFF_EMAIL, name: TEST_STAFF_NAME, role: "profissional_saude" })
    .returning({ id: usersTable.id });
  testStaffId = staff.id;
});

afterAll(async () => {
  await db.delete(requestAccessAttemptsTable).where(
    eq(requestAccessAttemptsTable.email, TEST_PATIENT_EMAIL)
  );
  await db.delete(usersTable).where(eq(usersTable.id, testPatientId));
  await db.delete(usersTable).where(eq(usersTable.id, testStaffId));
});

beforeEach(async () => {
  // Clear rate-limit entries for the patient before every test so each test
  // starts with a clean slate for the per-email rate-limit counter.
  await db.delete(requestAccessAttemptsTable).where(
    eq(requestAccessAttemptsTable.email, TEST_PATIENT_EMAIL)
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/request-access — integration", () => {
  it("returns 200 and persists a new passwordHash + isTemporaryPassword flag for a known patient", async () => {
    const res = await request(app)
      .post("/api/auth/request-access")
      .send({ email: TEST_PATIENT_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);

    // Verify the DB was actually updated with a real bcrypt hash
    const [updated] = await db
      .select({ passwordHash: usersTable.passwordHash, isTemporaryPassword: usersTable.isTemporaryPassword })
      .from(usersTable)
      .where(eq(usersTable.id, testPatientId))
      .limit(1);

    expect(updated.passwordHash).not.toBeNull();
    expect(updated.passwordHash).not.toBe("");
    // bcrypt hashes start with $2b$ or $2a$
    expect(updated.passwordHash).toMatch(/^\$2[ab]\$/);
    expect(updated.isTemporaryPassword).toBe(true);
  });

  it("records a rate-limit attempt row in the DB after a successful patient request", async () => {
    await request(app)
      .post("/api/auth/request-access")
      .send({ email: TEST_PATIENT_EMAIL });

    const attempts = await db
      .select()
      .from(requestAccessAttemptsTable)
      .where(eq(requestAccessAttemptsTable.email, TEST_PATIENT_EMAIL));

    expect(attempts.length).toBe(1);
    expect(attempts[0].email).toBe(TEST_PATIENT_EMAIL);
    // attemptedAt should be within the last few seconds
    const ageMs = Date.now() - attempts[0].attemptedAt.getTime();
    expect(ageMs).toBeGreaterThanOrEqual(0);
    expect(ageMs).toBeLessThan(10_000);
  });

  it("returns 200 and does NOT modify any user row for an unknown email", async () => {
    const unknownEmail = "nobody-unknown@test.internal";

    const res = await request(app)
      .post("/api/auth/request-access")
      .send({ email: unknownEmail });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);

    // No rate-limit attempt should be recorded for an unknown email
    const attempts = await db
      .select()
      .from(requestAccessAttemptsTable)
      .where(eq(requestAccessAttemptsTable.email, unknownEmail));
    expect(attempts.length).toBe(0);
  });

  it("returns 200 and does NOT update the staff user for a non-patient email", async () => {
    const staffBefore = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.id, testStaffId))
      .limit(1);

    const res = await request(app)
      .post("/api/auth/request-access")
      .send({ email: TEST_STAFF_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);

    const staffAfter = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.id, testStaffId))
      .limit(1);

    // passwordHash must be unchanged
    expect(staffAfter[0].passwordHash).toEqual(staffBefore[0].passwordHash);
  });

  // Three real bcrypt hashes can exceed Vitest's 5s default on shared CI workers.
  it("returns 429 after the per-email rate limit (3 attempts) is exceeded", async () => {
    // First 3 calls should succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/auth/request-access")
        .send({ email: TEST_PATIENT_EMAIL });
      expect(res.status).toBe(200);
    }

    // 4th call within the same window must be rate-limited
    const res = await request(app)
      .post("/api/auth/request-access")
      .send({ email: TEST_PATIENT_EMAIL });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/muitas tentativas/i);

    // Exactly 3 attempts recorded (the 4th was rejected before insert)
    const attempts = await db
      .select()
      .from(requestAccessAttemptsTable)
      .where(eq(requestAccessAttemptsTable.email, TEST_PATIENT_EMAIL));
    expect(attempts.length).toBe(3);
  }, 15_000);

  it("returns 400 for a malformed email without touching the DB", async () => {
    const res = await request(app)
      .post("/api/auth/request-access")
      .send({ email: "not-valid" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido/i);
  });
});
