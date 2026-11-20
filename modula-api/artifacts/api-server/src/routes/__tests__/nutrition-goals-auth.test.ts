import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ────────────────────────

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

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth, ensurePatientAccess } from "../../lib/auth-helpers";
import patientsRouter from "../patients";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function makeUpdateChain(returning: unknown[] = []): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returning);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(returning).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(returning).catch(handler);
  return chain;
}

// ── Shared fixtures ──────────────────────────────────────────────────────────

const DOCTOR_USER = {
  id: 2,
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

const PATIENT_USER = {
  ...OWNER_USER,
  id: 20,
  role: "patient" as const,
  email: "patient@clinic.com",
  name: "Patient",
};

const PATIENT_ROW = {
  id: 5,
  userId: 20,
  startWeight: "80",
  targetWeight: "65",
  dateOfBirth: null,
  dailyCalorieGoal: 2000,
  proteinGoalG: 150,
  carbGoalG: 200,
  fatGoalG: 60,
  mealsPerDay: 3,
  dietaryRestrictions: null,
  nutritionNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const VALID_BODY = { dailyCalorieGoal: 1800 };

// ── GET /patients/:patientId/nutrition-goals ──────────────────────────────────

describe("GET /patients/:patientId/nutrition-goals — patient IDOR protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when a patient token requests a different patient's goals", async () => {
    // PATIENT_USER has userId=20; PATIENT_ROW.userId=20 but we're requesting patientId=99
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: PATIENT_USER,
    });

    // ensurePatientAccess returns null — patientId does not belong to this user
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(buildApp()).get("/patients/99/nutrition-goals");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 200 when a patient token requests their own goals", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: PATIENT_USER,
    });

    // ensurePatientAccess returns the patient row — this is the patient's own record
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      PATIENT_ROW
    );

    const res = await request(buildApp()).get(
      `/patients/${PATIENT_ROW.id}/nutrition-goals`
    );

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(PATIENT_ROW.id);
    expect(res.body.dailyCalorieGoal).toBe(PATIENT_ROW.dailyCalorieGoal);
  });
});

// ── GET /patients/:patientId/nutrition-goals — doctor assignment check ────────

describe("GET /patients/:patientId/nutrition-goals — doctor assignment check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when a profissional_saude requests goals for a patient NOT assigned to them", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: DOCTOR_USER,
    });

    // ensurePatientAccess returns null — patient exists but doctor has no assignment
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(buildApp()).get("/patients/5/nutrition-goals");

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 200 when a profissional_saude requests goals for a patient assigned to them", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: DOCTOR_USER,
    });

    // ensurePatientAccess returns the patient row — doctor IS assigned
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      PATIENT_ROW
    );

    const res = await request(buildApp()).get(
      `/patients/${PATIENT_ROW.id}/nutrition-goals`
    );

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(PATIENT_ROW.id);
    expect(res.body.dailyCalorieGoal).toBe(PATIENT_ROW.dailyCalorieGoal);
  });
});

// ── PUT /patients/:patientId/nutrition-goals ──────────────────────────────────

describe("PUT /patients/:patientId/nutrition-goals — role-based authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 when a patient sets only their own dailyCalorieGoal", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: PATIENT_USER,
    });

    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      PATIENT_ROW
    );

    const updatedRow = { ...PATIENT_ROW, dailyCalorieGoal: 1800 };
    const updateChain = makeUpdateChain([updatedRow]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp())
      .put("/patients/5/nutrition-goals")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.dailyCalorieGoal).toBe(1800);
    // Only dailyCalorieGoal should be part of the update payload
    expect(updateChain.set).toHaveBeenCalledWith({ dailyCalorieGoal: 1800 });
  });

  it("returns 403 when a patient tries to set nutrition fields beyond dailyCalorieGoal", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: PATIENT_USER,
    });

    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      PATIENT_ROW
    );

    const res = await request(buildApp())
      .put("/patients/5/nutrition-goals")
      .send({ ...VALID_BODY, proteinGoalG: 150 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeTruthy();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 404 when a patient tries to set the daily calorie goal for another patient", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: PATIENT_USER,
    });

    // ensurePatientAccess returns null — patientId does not belong to this user
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(buildApp())
      .put("/patients/99/nutrition-goals")
      .send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 200 when the caller has role 'clinic_owner'", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER,
    });

    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      PATIENT_ROW
    );

    const updatedRow = { ...PATIENT_ROW, dailyCalorieGoal: 1800 };
    const updateChain = makeUpdateChain([updatedRow]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp())
      .put("/patients/5/nutrition-goals")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.dailyCalorieGoal).toBe(1800);
  });

  it("returns 404 when a profissional_saude tries to update goals for a patient NOT assigned to them", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: DOCTOR_USER,
    });

    // ensurePatientAccess returns null — patient exists but doctor has no assignment
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(buildApp())
      .put("/patients/5/nutrition-goals")
      .send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();

    // No DB write should have occurred
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 200 when a profissional_saude updates goals for a patient assigned to them", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: DOCTOR_USER,
    });

    // ensurePatientAccess returns the patient — doctor IS assigned
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      PATIENT_ROW
    );

    const updatedRow = { ...PATIENT_ROW, dailyCalorieGoal: 1800 };
    const updateChain = makeUpdateChain([updatedRow]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp())
      .put("/patients/5/nutrition-goals")
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.dailyCalorieGoal).toBe(1800);
  });
});
