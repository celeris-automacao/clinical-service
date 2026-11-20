import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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
  staffEventsTable: {},
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

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth, ensurePatientAccess } from "../../lib/auth-helpers";
import { sendTempPasswordEmail } from "../../lib/email";
import patientsRouter from "../patients";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  // Provide a minimal req.log shim so fire-and-forget .catch() handlers don't crash
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(patientsRouter);
  return app;
}

/**
 * Returns a chainable, thenable object suitable for mocking drizzle select
 * query builders. Every builder method (from, where, innerJoin, orderBy)
 * returns the same chain so any combination of those calls works.
 * `limit()` resolves to `data`, and the chain itself is thenable so
 * `await chain.where(...)` also resolves to `data`.
 */
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

/**
 * Returns a chainable, thenable object for mocking drizzle update builders.
 * `set()` and `where()` both return the chain so the full
 * `db.update(t).set({}).where(cond)` pattern resolves correctly.
 */
function makeUpdateChain(): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve([]).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve([]).catch(handler);
  return chain;
}

/**
 * Returns a chainable object for mocking drizzle insert builders.
 * Supports both the `.values().returning()` pattern (users/patients inserts)
 * and the `.values().onConflictDoNothing()` pattern (patientClinics/patientDoctors
 * enrollment inserts), since a single POST /patients call uses both.
 */
function makeInsertChain(returningData: unknown[] = []): any {
  const chain: any = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returningData);
  chain.onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  chain.catch = vi.fn(() => Promise.resolve(undefined));
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

const REQUIRED_PATIENT_DETAILS = {
  dateOfBirth: "1991-06-20",
  rg: "12.345.678-9",
  addressStreet: "Rua das Flores",
  addressNumber: "123",
  addressNeighborhood: "Centro",
  addressCity: "São Paulo",
  addressState: "SP",
  addressZip: "01001-000",
};

// ── POST /patients ────────────────────────────────────────────────────────────

describe("POST /patients — invite email on account creation", () => {
  const NEW_USER_ROW = {
    id: 10,
    email: "paciente@teste.com",
    name: "João Silva",
    role: "patient",
    clerkId: "manual_1000",
    passwordHash: "hashed_pw",
    isTemporaryPassword: true,
    avatarUrl: null,
    accessToken: null,
    deactivatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const NEW_PATIENT_ROW = {
    id: 5,
    userId: 10,
    startWeight: "90",
    targetWeight: "75",
    dateOfBirth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  it("calls sendTempPasswordEmail with the correct email, name, and a non-empty temp password", async () => {
    // Account, patient, clinic enrollment, then CPF identity audit.
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([NEW_USER_ROW]))
      .mockReturnValueOnce(makeInsertChain([NEW_PATIENT_ROW]))
      .mockReturnValueOnce(makeInsertChain())
      .mockReturnValueOnce(makeInsertChain());

    // Select order for a clinic_owner POST /patients call:
    //   1. resolveOwnerClinicId (clinicOwnersTable lookup)
    //   2. CPF identity lookup
    //   3. buildPatientResponse — weightEntries
    //   4. buildPatientResponse — xpEntries sum
    //   5. buildPatientResponse — careTeam (patientDoctors join)
    //   6. fetchClinicBranding (fire-and-forget) — clinicSettings
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      // CPF lookup finds no existing account.
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).post("/patients").send({
      ...REQUIRED_PATIENT_DETAILS,
      name: "João Silva",
      email: "paciente@teste.com",
      phone: "11999999999",
      cpf: "11144477735",
      startWeight: 90,
      targetWeight: 75,
    });

    // Flush the event-loop so the fire-and-forget email promise settles
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(201);

    expect(sendTempPasswordEmail).toHaveBeenCalledOnce();
    const emailArgs = (sendTempPasswordEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(emailArgs.to).toBe("paciente@teste.com");
    expect(emailArgs.name).toBe("João Silva");
    expect(typeof emailArgs.tempPassword).toBe("string");
    expect(emailArgs.tempPassword.length).toBeGreaterThan(0);
  });

  it("returns 403 and does not send email when caller is not a clinic_owner", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...OWNER_USER, id: 2, role: "profissional_saude" as const },
    });
    // The professional_saude branch looks up the caller's doctor record first;
    // no matching record means "Profissional não encontrado" (403).
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).post("/patients").send({
      name: "Test",
      email: "t@t.com",
      startWeight: 80,
    });

    expect(res.status).toBe(403);
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("reuses an existing user by CPF even when the request email differs", async () => {
    const existingUserRow = {
      ...NEW_USER_ROW,
      id: 99,
      email: "global@patient.com",
      cpf: "11144477735",
      isTemporaryPassword: false,
    };
    const existingPatientRow = {
      ...NEW_PATIENT_ROW,
      id: 44,
      userId: existingUserRow.id,
    };

    const patientInsertChain = makeInsertChain([existingPatientRow]);
    const clinicInsertChain = makeInsertChain();
    const staffEventInsertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(patientInsertChain)
      .mockReturnValueOnce(clinicInsertChain)
      .mockReturnValueOnce(staffEventInsertChain);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 1 }]))
      .mockReturnValueOnce(makeSelectChain([existingUserRow]))
      // The global account has no existing enrollment in this clinic.
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).post("/patients").send({
      ...REQUIRED_PATIENT_DETAILS,
      name: "João Silva",
      email: "outra@clinica.com",
      phone: "11999999999",
      cpf: "111.444.777-35",
      startWeight: 90,
      targetWeight: 75,
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(res.status).toBe(201);
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
    expect(patientInsertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: existingUserRow.id, cpf: "11144477735" })
    );
  });
});

// ── POST /patients/:patientId/resend-invite ───────────────────────────────────

describe("POST /patients/:patientId/resend-invite — invite email on resend", () => {
  /**
   * Patient who still has a temporary password (onboarding not complete).
   * The resend-invite endpoint is only valid for this state.
   */
  const PATIENT_USER_WITH_TEMP_PW = {
    id: 10,
    email: "ana@teste.com",
    name: "Ana Souza",
    role: "patient" as const,
    clerkId: "manual_9",
    passwordHash: "old_hash",
    isTemporaryPassword: true,
    avatarUrl: null,
    accessToken: null,
    deactivatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * Patient who has already set their own password (onboarding complete).
   * The resend-invite endpoint must reject this with 409.
   */
  const PATIENT_USER_WITH_OWN_PW = {
    ...PATIENT_USER_WITH_TEMP_PW,
    isTemporaryPassword: false,
  };

  const PATIENT_ROW = {
    id: 5,
    userId: 10,
    startWeight: "80",
    targetWeight: "65",
    dateOfBirth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
  });

  it("sets isTemporaryPassword to true and calls sendTempPasswordEmail with patient credentials", async () => {
    // Select 1: patient+user join → patient with temp password
    // Select 2: fetchClinicBranding → clinicSettings (empty, branding fields will be null)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ patient: PATIENT_ROW, user: PATIENT_USER_WITH_TEMP_PW }]))
      .mockReturnValueOnce(makeSelectChain([]));

    // ensurePatientAccess is a fully mocked module function — resolve it truthy
    // so the route proceeds past the access-control guard.
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(PATIENT_ROW);

    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp()).post("/patients/5/resend-invite");

    // Wait for fire-and-forget email to settle
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The update must have set isTemporaryPassword: true
    expect(updateChain.set).toHaveBeenCalledOnce();
    expect(updateChain.set.mock.calls[0][0]).toMatchObject({ isTemporaryPassword: true });

    // The email must have been sent to the patient with a fresh temp password
    expect(sendTempPasswordEmail).toHaveBeenCalledOnce();
    const emailArgs = (sendTempPasswordEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(emailArgs.to).toBe("ana@teste.com");
    expect(emailArgs.name).toBe("Ana Souza");
    expect(typeof emailArgs.tempPassword).toBe("string");
    expect(emailArgs.tempPassword.length).toBeGreaterThan(0);
  });

  it("returns 409 and does not send email when the patient has already set their own password", async () => {
    // The guard checks isTemporaryPassword === false → refuse to overwrite patient's own password
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([{ patient: PATIENT_ROW, user: PATIENT_USER_WITH_OWN_PW }])
    );
    // Access control passes; the 409 comes from the temp-password guard below it.
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(PATIENT_ROW);

    const res = await request(buildApp()).post("/patients/5/resend-invite");

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("O paciente");
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("returns 404 and does not send email when patient does not exist", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).post("/patients/999/resend-invite");

    expect(res.status).toBe(404);
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("returns 403 and does not send email when caller has role patient", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...OWNER_USER, id: 3, role: "patient" as const },
    });

    const res = await request(buildApp()).post("/patients/5/resend-invite");

    expect(res.status).toBe(403);
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });
});
