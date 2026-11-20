import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  usersTable: {},
  patientsTable: {},
  patientDoctorsTable: {},
  doctorsTable: {},
  doctorInsurancesTable: {},
  weightEntriesTable: {},
  xpEntriesTable: {},
  clinicOwnersTable: {},
  patientClinicsTable: {},
  clinicSettingsTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn(),
  resolveCallerClinicId: vi.fn().mockResolvedValue(1),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendTempPasswordEmail: vi.fn(),
  sendAuditFailureAlertEmail: vi.fn(),
}));

import { db } from "@workspace/db";
import { requireAuth, ensurePatientAccess } from "../../lib/auth-helpers";
import patientsRouter from "../patients";

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
  chain.then = (onFulfilled: any, onRejected: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
}

function makeInsertChain(): any {
  const chain: any = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  return chain;
}

const OWNER_AUTH = {
  user: {
    id: 1,
    email: "owner@clinic.dev",
    name: "Owner",
    role: "clinic_owner" as const,
    clerkId: null,
    passwordHash: null,
    isTemporaryPassword: false,
    avatarUrl: null,
    deactivatedAt: null,
    appleUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  clinicId: 1,
};

const DOCTOR_AUTH = {
  ...OWNER_AUTH,
  user: { ...OWNER_AUTH.user, id: 2, role: "profissional_saude" as const, email: "doctor@clinic.dev" },
};

const SECRETARY_AUTH = {
  ...OWNER_AUTH,
  user: { ...OWNER_AUTH.user, id: 3, role: "secretaria" as const, email: "secretary@clinic.dev" },
};

const PATIENT_AUTH = {
  ...OWNER_AUTH,
  user: { ...OWNER_AUTH.user, id: 4, role: "patient" as const, email: "patient@clinic.dev" },
};

const PATIENT_ROW = {
  id: 8,
  userId: 4,
  clinicId: 1,
  name: "Paciente QA",
  email: "patient@clinic.dev",
  avatarUrl: null,
  dateOfBirth: "1990-01-02",
  allergies: "amendoim",
  hasAllergies: true,
  medicalConditions: "hipertensao",
  dietaryRestrictions: "sem lactose",
  hasDietaryRestrictions: true,
  psychologyNotes: "nota psicologica",
  physicalActivityNotes: "nota atividade",
  endocrinologyNotes: "nota endocrino",
  phone: "11999999999",
  cpf: "111.222.333-44",
  rg: "12.345.678-9",
  addressStreet: "Rua A",
  addressNumber: "123",
  addressComplement: "apto 2",
  addressNeighborhood: "Centro",
  addressCity: "Sao Paulo",
  addressState: "SP",
  addressZip: "01000-000",
  paymentType: "convenio",
  insuranceName: "Plano X",
  startWeight: "90",
  targetWeight: "75",
  proposedTargetWeight: "78",
  weightGoalStatus: "pending",
  weightGoalValidatedByUserId: null,
  weightGoalValidatedAt: null,
  dailyCalorieGoal: 1800,
  waterReminderEnabled: true,
  waterReminderHour: 8,
  waterReminderMinute: 30,
  waterReminderFrequency: 4,
  weightReminderEnabled: true,
  weightReminderHour: 7,
  weightReminderMinute: 0,
  weightReminderFrequency: 7,
  createdAt: new Date("2026-08-01T12:00:00.000Z"),
};

const USER_ROW = {
  id: 4,
  email: "patient@clinic.dev",
  name: "Paciente QA",
  avatarUrl: null,
  isTemporaryPassword: true,
  temporaryPasswordExpiresAt: new Date("2026-08-06T12:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
});

function mockPatientResponseDb() {
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(makeSelectChain([]))
    .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
    .mockReturnValueOnce(makeSelectChain([]));
}

describe("GET /patients/:patientId — response policy", () => {
  it("returns the full payload for clinic_owner", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...PATIENT_ROW, user: USER_ROW });
    mockPatientResponseDb();

    const res = await request(buildApp()).get("/patients/8");

    expect(res.status).toBe(200);
    expect(res.body.cpf).toBe(PATIENT_ROW.cpf);
    expect(res.body.rg).toBe(PATIENT_ROW.rg);
    expect(res.body.medicalConditions).toBe(PATIENT_ROW.medicalConditions);
    expect(res.body.paymentType).toBe(PATIENT_ROW.paymentType);
    expect(res.body.insuranceName).toBe(PATIENT_ROW.insuranceName);
    expect(res.body.reminderSettings.water.enabled).toBe(true);
    expect(res.body.currentWeight).toBeNull();
  });

  it("returns the full payload for profissional_saude", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...PATIENT_ROW, user: USER_ROW });
    mockPatientResponseDb();

    const res = await request(buildApp()).get("/patients/8");

    expect(res.status).toBe(200);
    expect(res.body.cpf).toBe(PATIENT_ROW.cpf);
    expect(res.body.medicalConditions).toBe(PATIENT_ROW.medicalConditions);
    expect(res.body.paymentType).toBe(PATIENT_ROW.paymentType);
    expect(res.body.weightGoalStatus).toBe(PATIENT_ROW.weightGoalStatus);
  });

  it("uses the account phone when the patient record does not have one", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...PATIENT_ROW,
      phone: null,
      user: { ...USER_ROW, phone: "11999999999" },
    });
    mockPatientResponseDb();

    const res = await request(buildApp()).get("/patients/8");

    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("11999999999");
  });

  it("returns the administrative payload for secretaria", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SECRETARY_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...PATIENT_ROW, user: USER_ROW });
    mockPatientResponseDb();

    const res = await request(buildApp()).get("/patients/8");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(PATIENT_ROW.name);
    expect(res.body.email).toBe(PATIENT_ROW.email);
    expect(res.body.phone).toBe(PATIENT_ROW.phone);
    expect(res.body.clinic).toEqual({ id: 1 });
    expect(res.body.invitation).toEqual({ pending: true });
    expect(res.body.status).toEqual({
      isTemporaryPassword: true,
      temporaryPasswordExpiresAt: USER_ROW.temporaryPasswordExpiresAt.toISOString(),
    });
    expect(res.body.cpf).toBeUndefined();
    expect(res.body.rg).toBeUndefined();
    expect(res.body.medicalConditions).toBeUndefined();
    expect(res.body.weightGoalStatus).toBeUndefined();
    expect(res.body.dailyCalorieGoal).toBeUndefined();
    expect(res.body.reminderSettings).toBeUndefined();
    expect(res.body.paymentType).toBeUndefined();
    expect(res.body.insuranceName).toBeUndefined();
  });

  it("preserves the patient self-view behavior", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...PATIENT_ROW, user: USER_ROW });
    mockPatientResponseDb();

    const res = await request(buildApp()).get("/patients/8");

    expect(res.status).toBe(200);
    expect(res.body.cpf).toBe(PATIENT_ROW.cpf);
    expect(res.body.rg).toBe(PATIENT_ROW.rg);
    expect(res.body.medicalConditions).toBe(PATIENT_ROW.medicalConditions);
    expect(res.body.paymentType).toBeUndefined();
    expect(res.body.insuranceName).toBeUndefined();
    expect(res.body.dailyCalorieGoal).toBe(PATIENT_ROW.dailyCalorieGoal);
  });
});
