import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ─────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  usersTable: {},
  patientsTable: {},
  patientDoctorsTable: {},
  doctorsTable: {},
  weightEntriesTable: {},
  xpEntriesTable: {},
  checkInsTable: {},
  clinicSettingsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn(),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_pw"),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db, clinicOwnersTable, patientClinicsTable } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import patientsRouter from "../patients";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(patientsRouter);
  return app;
}

function makeSelectChain(data: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
}

/** Returns "YYYY-MM-DD" for a date offset from today by `deltaDays` days. */
function dobForDaysOut(today: Date, deltaDays: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + deltaDays);
  // Use a past year so the patient has an actual past birth year
  return `1990-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OWNER_USER = {
  id: 1,
  role: "clinic_owner" as const,
  email: "owner@clinic.com",
  name: "Owner",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePatientRow(id: number, dateOfBirth: string) {
  return {
    patient: {
      id,
      userId: id + 100,
      dateOfBirth,
      startWeight: "80",
      targetWeight: "70",
      dailyCalorieGoal: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: id + 100,
      name: `Patient ${id}`,
      email: `patient${id}@test.com`,
      role: "patient",
      clerkId: null,
      passwordHash: null,
      accessToken: null,
      isTemporaryPassword: false,
      avatarUrl: null,
      deactivatedAt: null as Date | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function mockOwnerPatients(rows: ReturnType<typeof makePatientRow>[]) {
  vi.mocked(db.select).mockImplementation(() => ({
    from: vi.fn((table: unknown) => {
      if (table === clinicOwnersTable) return makeSelectChain([{ clinicId: 1 }]);
      if (table === patientClinicsTable) {
        return makeSelectChain(rows.map(({ patient }) => ({ patientId: patient.id })));
      }
      return makeSelectChain(rows);
    }),
  }) as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/**
 * We pin "today" to 2026-06-15 (midnight) using fake timers so all
 * daysUntilBirthday calculations are deterministic regardless of when the
 * tests actually run.
 */
const PINNED_TODAY = new Date(2026, 5, 15, 0, 0, 0, 0); // June 15 2026

describe("GET /patients/upcoming-birthdays — day-boundary correctness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PINNED_TODAY);
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns daysUntilBirthday = 0 for a patient whose birthday is today", async () => {
    const todayDob = dobForDaysOut(PINNED_TODAY, 0); // "1990-06-15"
    const rows = [makePatientRow(1, todayDob)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].daysUntilBirthday).toBe(0);
    expect(res.body[0].id).toBe(1);
  });

  it("includes a patient whose birthday is exactly 7 days out (daysUntilBirthday = 7)", async () => {
    const dob7 = dobForDaysOut(PINNED_TODAY, 7); // "1990-06-22"
    const rows = [makePatientRow(2, dob7)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].daysUntilBirthday).toBe(7);
    expect(res.body[0].id).toBe(2);
  });

  it("excludes a patient whose birthday is 8 days out (beyond the 7-day default window)", async () => {
    const dob8 = dobForDaysOut(PINNED_TODAY, 8); // "1990-06-23"
    const rows = [makePatientRow(3, dob8)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("includes today (0) and 7-day patient but excludes 8-day patient when all three are present", async () => {
    const dobToday = dobForDaysOut(PINNED_TODAY, 0);
    const dob7 = dobForDaysOut(PINNED_TODAY, 7);
    const dob8 = dobForDaysOut(PINNED_TODAY, 8);
    const rows = [
      makePatientRow(10, dobToday),
      makePatientRow(11, dob7),
      makePatientRow(12, dob8),
    ];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    const ids = res.body.map((b: { id: number }) => b.id);
    expect(ids).toContain(10);
    expect(ids).toContain(11);
    expect(ids).not.toContain(12);
  });

  it("sorts results ascending by daysUntilBirthday (today first)", async () => {
    const dobToday = dobForDaysOut(PINNED_TODAY, 0);
    const dob3 = dobForDaysOut(PINNED_TODAY, 3);
    const dob7 = dobForDaysOut(PINNED_TODAY, 7);
    // Return rows in reverse order to confirm sorting works
    const rows = [makePatientRow(7, dob7), makePatientRow(3, dob3), makePatientRow(0, dobToday)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    const days = res.body.map((b: { daysUntilBirthday: number }) => b.daysUntilBirthday);
    expect(days).toEqual([0, 3, 7]);
  });

  it("returns 403 when caller has role 'patient'", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...OWNER_USER, role: "patient" as const },
    });

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(403);
  });

  it("returns an empty array when no patients have a birthday within 7 days", async () => {
    const dob8 = dobForDaysOut(PINNED_TODAY, 8);
    const dob30 = dobForDaysOut(PINNED_TODAY, 30);
    const rows = [makePatientRow(20, dob8), makePatientRow(21, dob30)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("excludes a deactivated patient even when their birthday is today", async () => {
    const todayDob = dobForDaysOut(PINNED_TODAY, 0);
    const activeRow = makePatientRow(30, todayDob);
    const deactivatedRow = {
      ...makePatientRow(31, todayDob),
      user: { ...makePatientRow(31, todayDob).user, deactivatedAt: new Date("2025-01-01") },
    };

    mockOwnerPatients([activeRow, deactivatedRow]);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    const ids = res.body.map((b: { id: number }) => b.id);
    expect(ids).toContain(30);
    expect(ids).not.toContain(31);
  });
});

/**
 * Year-boundary tests: today is pinned to late December so that the 7-day
 * window crosses into January of the following year.
 */
describe("GET /patients/upcoming-birthdays — year-boundary (Dec → Jan)", () => {
  // Dec 28 2026 midnight
  const DEC_28 = new Date(2026, 11, 28, 0, 0, 0, 0);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(DEC_28);
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("includes a patient born Jan 2 when today is Dec 28 (daysUntilBirthday = 5)", async () => {
    // Jan 2 in a past year — DOB crosses the year boundary from the pinned date
    const janSecondDob = "1990-01-02";
    const rows = [makePatientRow(50, janSecondDob)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(50);
    expect(res.body[0].daysUntilBirthday).toBe(5);
  });

  it("excludes a patient born Jan 6 when today is Dec 28 (8 days out, beyond the 7-day window)", async () => {
    const janSixthDob = "1990-01-06";
    const rows = [makePatientRow(51, janSixthDob)];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("includes Dec 31 (3 days) and Jan 2 (5 days) but excludes Jan 6 (8 days)", async () => {
    const rows = [
      makePatientRow(60, "1990-12-31"), // 3 days out
      makePatientRow(61, "1990-01-02"), // 5 days out (crosses year boundary)
      makePatientRow(62, "1990-01-06"), // 8 days out — excluded
    ];

    mockOwnerPatients(rows);

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    const ids = res.body.map((b: { id: number }) => b.id);
    expect(ids).toContain(60);
    expect(ids).toContain(61);
    expect(ids).not.toContain(62);

    const days = res.body.map((b: { daysUntilBirthday: number }) => b.daysUntilBirthday);
    expect(days).toEqual([3, 5]);
  });
});

/**
 * Verifies that the upcoming-birthdays endpoint scopes results to the doctor's
 * assigned patients when the caller has role `profissional_saude`.
 *
 * The production handler makes four sequential db.select() calls for this role:
 *   1. Look up the doctor record by userId
 *   2. Fetch patient-doctor assignment rows
 *   3. Intersect assignments with clinic enrollments
 *   4. Fetch patient+user rows filtered to allowedPatientIds
 *
 * We use mockReturnValueOnce to stub each call independently.
 */
describe("GET /patients/upcoming-birthdays — profissional_saude scoping", () => {
  const DOCTOR_USER = {
    id: 5,
    role: "profissional_saude" as const,
    email: "doctor@clinic.com",
    name: "Doctor",
    clerkId: null,
    passwordHash: null,
    accessToken: null,
    isTemporaryPassword: false,
    avatarUrl: null,
    deactivatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const DOCTOR_RECORD = [
    {
      id: 10,
      userId: 5,
      clinicId: 1,
      specialty: null,
      bio: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(PINNED_TODAY);
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns only the assigned patient's upcoming birthday, not the unassigned one", async () => {
    const dobToday = dobForDaysOut(PINNED_TODAY, 0); // assigned patient — birthday today

    const assignedPatientRow = makePatientRow(1, dobToday);

    // Call 1: doctor record
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain(DOCTOR_RECORD));
    // Call 2: patient-doctor assignments — only patient 1 is assigned
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([{ patientId: 1 }]),
    );
    // Call 3: assignments are limited to patients enrolled in the doctor's clinic.
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([{ patientId: 1 }]),
    );
    // Call 4: patient rows filtered to allowedPatientIds=[1].
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([assignedPatientRow]),
    );

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].daysUntilBirthday).toBe(0);
  });

  it("returns [] when the doctor has no patients assigned", async () => {
    // Call 1: doctor record found
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain(DOCTOR_RECORD));
    // Call 2: assignments empty → handler returns early with []
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns [] when no doctor record exists for the authenticated user", async () => {
    // Call 1: doctor lookup returns empty → handler returns early with []
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns [] immediately after a doctor is unassigned from the only patient they were managing", async () => {
    // Scenario: doctor WAS assigned to patient 1 (birthday today), but the
    // assignment was just removed.  The patientDoctorsTable now returns an
    // empty list, so the handler must short-circuit to [] without leaking the
    // birthday and without making a third DB call.

    // Call 1: doctor record exists
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain(DOCTOR_RECORD));
    // Call 2: assignments are now empty — the doctor was unassigned
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    // Confirm the handler short-circuited: only 2 DB calls (doctor lookup +
    // assignments), never reaching the patient-fetch query.
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it("filters correctly when assigned patient has no upcoming birthday within the window", async () => {
    const dobIn30 = dobForDaysOut(PINNED_TODAY, 30); // outside default 7-day window

    const patientRow = makePatientRow(3, dobIn30);

    // Call 1: doctor record
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain(DOCTOR_RECORD));
    // Call 2: assignment exists for patient 3
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([{ patientId: 3 }]),
    );
    // Call 3: clinic enrollment contains the assigned patient.
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([{ patientId: 3 }]));
    // Call 4: DB returns the one assigned patient (birthday 30 days away).
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([patientRow]));

    const res = await request(buildApp()).get("/patients/upcoming-birthdays");

    expect(res.status).toBe(200);
    // Birthday is 30 days out — beyond the 7-day window — so filtered in JS post-query
    expect(res.body).toEqual([]);
  });
});

/**
 * Verifies the frontend label mapping that doctors see.
 *
 * The patients page maps `daysUntilBirthday` to a human label:
 *   0  → "Aniversário hoje 🎂"
 *   1  → "Aniversário amanhã"
 *   N  → "Aniversário em N dias"
 *
 * These are pure functions co-located in `artifacts/clinic-web/src/pages/patients.tsx`.
 * Because they are inline arrow functions (not exported), we test the equivalent
 * logic here to confirm the contract matches what the API delivers.
 */
describe("birthday label mapping (mirrors patients.tsx inline function)", () => {
  function birthdayLabel(days: number): string {
    if (days === 0) return "Aniversário hoje 🎂";
    if (days === 1) return "Aniversário amanhã";
    return `Aniversário em ${days} dias`;
  }

  it("returns 'Aniversário hoje 🎂' when daysUntilBirthday is 0", () => {
    expect(birthdayLabel(0)).toBe("Aniversário hoje 🎂");
  });

  it("returns 'Aniversário amanhã' when daysUntilBirthday is 1", () => {
    expect(birthdayLabel(1)).toBe("Aniversário amanhã");
  });

  it("returns 'Aniversário em 7 dias' when daysUntilBirthday is 7", () => {
    expect(birthdayLabel(7)).toBe("Aniversário em 7 dias");
  });
});
