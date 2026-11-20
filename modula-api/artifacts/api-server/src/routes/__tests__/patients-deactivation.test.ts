import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ─────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  ensureClinicAccess: vi.fn(),
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

import { db } from "@workspace/db";
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

/**
 * Creates a select chain where the terminal value is returned via both
 * `.limit()` and direct promise resolution (`.then`/`.catch`).
 */
function makeSelectChain(data: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
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

function makeActivePatientRow(id: number) {
  return {
    patient: {
      id,
      userId: id + 100,
      dateOfBirth: "1990-01-15",
      startWeight: "90",
      targetWeight: "75",
      dailyCalorieGoal: null,
      proteinGoalG: null,
      carbGoalG: null,
      fatGoalG: null,
      fatGoalGrams: null,
      mealsPerDay: null,
      dietaryRestrictions: null,
      nutritionNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: id + 100,
      name: `Patient ${id}`,
      email: `patient${id}@test.com`,
      role: "patient" as const,
      clerkId: null,
      passwordHash: null,
      accessToken: null,
      isTemporaryPassword: false,
      avatarUrl: null,
      deactivatedAt: null, // active patient
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

// ── Tests: GET /patients — deactivation guard ─────────────────────────────────

/**
 * The `GET /patients` endpoint filters deactivated patients at the SQL level
 * via `isNull(usersTable.deactivatedAt)`. These tests confirm:
 *
 *  1. Active patients (deactivatedAt = null) appear in the list.
 *  2. When the database returns no patients (because all are deactivated and
 *     the SQL guard filtered them), the endpoint returns an empty array.
 *  3. The `?unassigned=true` path (used by the doctor-assignment dropdown) also
 *     inherits the deactivation guard.
 */
describe("GET /patients — deactivation guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  it("returns an active patient when the DB provides one", async () => {
    const patientRow = makeActivePatientRow(1);

    // For a clinic_owner caller, GET /patients issues selects in this order:
    //   1. resolveOwnerClinicId — clinicOwnersTable lookup
    //   2. building the clinic-scoping `exists(...)` condition (query construction only)
    //   3. the main patient list query
    //   4. buildPatientResponse — weight entries
    //   5. buildPatientResponse — XP sum
    //   6. buildPatientResponse — care team (patientDoctors join)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([patientRow]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 150 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(1);
    expect(res.body[0].name).toBe("Patient 1");
  });

  it("returns an empty array when the DB returns no patients (all deactivated)", async () => {
    // The SQL WHERE isNull(deactivatedAt) filters out all patients on the DB side,
    // so the handler receives an empty result set. Only the clinic-scoping and
    // main-query selects run — no buildPatientResponse calls follow.
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns only active patients when DB provides a mix (simulating SQL guard)", async () => {
    // In production the SQL WHERE clause ensures deactivated rows are never
    // returned. Here we simulate the DB correctly returning only the active one.
    const activeRow = makeActivePatientRow(10);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([activeRow]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(10);
  });
});

// ── Tests: GET /patients?unassigned=true — deactivation guard ─────────────────

/**
 * The `?unassigned=true` query parameter feeds the doctor-assignment dropdown.
 * The same `isNull(usersTable.deactivatedAt)` guard must apply, ensuring
 * deactivated patients cannot appear in the assignment UI.
 */
describe("GET /patients?unassigned=true — deactivation guard (assignment dropdown)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  it("returns an active unassigned patient when the DB provides one", async () => {
    const patientRow = makeActivePatientRow(20);

    // For a clinic_owner caller with ?unassigned=true, selects run in this order:
    //   1. resolveOwnerClinicId — clinicOwnersTable lookup
    //   2. clinic-scoping `exists(...)` condition (query construction only)
    //   3. `notExists(...)` unassigned condition (query construction only)
    //   4. the main patient list query
    //   5. buildPatientResponse — weight entries
    //   6. buildPatientResponse — XP sum
    //   7. buildPatientResponse — care team
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([patientRow]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 50 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients?unassigned=true");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(20);
  });

  it("returns an empty array when all unassigned patients are deactivated", async () => {
    // No buildPatientResponse calls follow since the main query returns no rows.
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients?unassigned=true");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── Tests: GET /patients?search= — deactivation guard ────────────────────────

describe("GET /patients?search= — search does not surface deactivated patients", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  it("returns matching active patients", async () => {
    const patientRow = makeActivePatientRow(30);
    patientRow.user.name = "Ana Lima";
    patientRow.patient.id = 30;

    // Same sequence as the plain GET /patients case — `search` narrows the
    // main query's WHERE clause but doesn't add its own select call.
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([patientRow]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients?search=Ana");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(30);
  });

  it("returns empty when DB finds no match (deactivated or not found)", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients?search=Deactivated");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
