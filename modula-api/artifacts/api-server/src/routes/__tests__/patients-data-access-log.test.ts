import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  doctorInsurancesTable: {},
  weightEntriesTable: {},
  xpEntriesTable: {},
  checkInsTable: {},
  clinicSettingsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  dataAccessLogTable: {},
  auditFailuresTable: {},
  staffEventsTable: {},
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(() => ({ userId: null })),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn(),
  ensureClinicAccess: vi.fn(),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
  resolveCallerClinicId: vi.fn().mockResolvedValue(1),
}));

vi.mock("../../lib/email", () => ({
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendAuditFailureAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_pw"),
  signAccessToken: vi.fn().mockResolvedValue("access_token"),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth, ensurePatientAccess, resolveCallerClinicId } from "../../lib/auth-helpers";
import { sendAuditFailureAlertEmail } from "../../lib/email";
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

function makeInsertChain(returnValue: unknown = []): any {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(returnValue).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(returnValue).catch(handler);
  return chain;
}

function makeRejectInsertChain(err: Error): any {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.reject(err).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.reject(err).catch(handler);
  return chain;
}

function makeRejectSelectChain(err: Error): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn().mockRejectedValue(err);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.reject(err).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.reject(err).catch(handler);
  return chain;
}

function buildAppWithLog(logOverride?: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> }) {
  const log = logOverride ?? { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = log;
    next();
  });
  app.use(patientsRouter);
  return { app, log };
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const DOCTOR_AUTH = {
  user: {
    id: 20,
    email: "doctor@clinica.dev",
    name: "Dr. Tester",
    role: "profissional_saude" as const,
    clerkId: null,
    passwordHash: "hashed_pw",
    isTemporaryPassword: false,
    avatarUrl: null,
    deactivatedAt: null,
    appleUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  clinicId: 1,
};

const OWNER_AUTH = {
  ...DOCTOR_AUTH,
  user: { ...DOCTOR_AUTH.user, id: 21, role: "clinic_owner" as const },
};

const SECRETARY_AUTH = {
  user: {
    ...DOCTOR_AUTH.user,
    id: 22,
    email: "secretary@clinica.dev",
    name: "Secretária Tester",
    role: "secretaria" as const,
  },
  clinicId: 1,
};

const PATIENT_AUTH = {
  user: {
    ...DOCTOR_AUTH.user,
    id: 30,
    email: "patient@clinica.dev",
    role: "patient" as const,
  },
  clinicId: null,
};

const USER_ROW = {
  id: 30,
  email: "patient@clinica.dev",
  name: "Paciente Tester",
  role: "patient" as const,
  clerkId: null,
  passwordHash: null,
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  appleUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Full patient row — note the `user` property is included so buildPatientResponse
// skips the extra usersTable SELECT (see: `patient.user ?? db.select()...`)
const PATIENT_ROW_WITH_CPF = {
  id: 5,
  userId: 30,
  clinicId: null,
  name: "Paciente Tester",
  email: "patient@clinica.dev",
  cpf: "111.222.333-44",
  rg: null,
  phone: null,
  dateOfBirth: null,
  targetWeight: null,
  startWeight: null,
  avatarUrl: null,
  allergies: null,
  hasAllergies: false,
  medicalConditions: null,
  dietaryRestrictions: null,
  hasDietaryRestrictions: false,
  psychologyNotes: null,
  physicalActivityNotes: null,
  endocrinologyNotes: null,
  paymentType: "particular",
  insuranceName: null,
  addressStreet: null,
  addressNumber: null,
  addressComplement: null,
  addressNeighborhood: null,
  addressCity: null,
  addressState: null,
  addressZip: null,
  weightGoalValidatedByUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Inline user so buildPatientResponse doesn't need an extra DB query
  user: USER_ROW,
};

const PATIENT_ROW_NO_SENSITIVE = {
  ...PATIENT_ROW_WITH_CPF,
  cpf: null,
  rg: null,
  phone: null,
  medicalConditions: null,
  psychologyNotes: null,
  physicalActivityNotes: null,
  endocrinologyNotes: null,
};

/**
 * Provides the minimum DB mock calls needed for buildPatientResponse to succeed:
 *   1. weightEntriesTable select (empty → no current weight)
 *   2. xpEntriesTable select (0 XP)
 *   3. patientDoctorsTable select (no care team)
 *
 * PATIENT_ROW already has `user` attached so the usersTable lookup is skipped.
 * weightGoalValidatedByUserId is null so validator lookup is also skipped.
 */
function mockBuildPatientResponseDbCalls() {
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(makeSelectChain([]))      // weightEntriesTable
    .mockReturnValueOnce(makeSelectChain([{ total: 0 }])) // xpEntriesTable
    .mockReturnValueOnce(makeSelectChain([]));     // patientDoctorsTable care team
}

// ── GET /patients/:patientId — data_access_log ────────────────────────────────

describe("GET /patients/:patientId — data_access_log on sensitive field access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fires a data_access_log insert when staff accesses a patient with a CPF", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_WITH_CPF
    );
    mockBuildPatientResponseDbCalls();

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues).toMatchObject({
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
    });
    expect(insertedValues.fieldsAccessed).toContain("cpf");
  });

  it("logs the clinic_owner role correctly when an owner accesses a patient with sensitive fields", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_WITH_CPF
    );
    mockBuildPatientResponseDbCalls();

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues.accessorRole).toBe("clinic_owner");
    expect(insertedValues.clinicId).toBe(1);
    expect(insertedValues.fieldsAccessed).toContain("cpf");
  });

  it("does NOT fire a data_access_log insert when a patient accesses their own data", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_WITH_CPF
    );
    mockBuildPatientResponseDbCalls();

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("fires a data_access_log insert with an empty fieldsAccessed array when no sensitive fields are populated", async () => {
    // LGPD Art. 37 requires a full audit trail of staff accesses, even when the
    // patient has no sensitive fields filled in yet. The log must still be written
    // with fieldsAccessed: [] so the clinic owner can see the access occurred.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_NO_SENSITIVE
    );
    mockBuildPatientResponseDbCalls();

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues).toMatchObject({
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
    });
    expect(insertedValues.fieldsAccessed).toEqual([]);
  });

  it("logs the secretaria role without claiming access to redacted sensitive fields", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SECRETARY_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_WITH_CPF
    );
    mockBuildPatientResponseDbCalls();

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues).toMatchObject({
      accessorUserId: SECRETARY_AUTH.user.id,
      accessorRole: "secretaria",
      patientId: 5,
      clinicId: 1,
    });
    expect(res.body).not.toHaveProperty("cpf");
    expect(insertedValues.fieldsAccessed).toEqual([]);
  });

  it("resolves clinicId via resolveCallerClinicId when secretaria JWT has no embedded clinic claim", async () => {
    // Reproduce the secretaria scenario: a secretaria logs in via POST /auth/login
    // and the JWT does NOT carry a clinicId claim, so authResult.clinicId is undefined.
    // The handler must fall back to resolveCallerClinicId to stamp the correct clinic
    // on the audit record — without this the row would be inserted with clinicId=null
    // and become invisible via GET /clinics/me/access-logs (which filters by clinicId).
    const SECRETARY_NO_CLINIC_JWT = {
      user: {
        ...DOCTOR_AUTH.user,
        id: 22,
        email: "secretary@clinica.dev",
        name: "Secretária Tester",
        role: "secretaria" as const,
      },
      // clinicId intentionally absent — mirrors JWT without clinicId claim
    };

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(SECRETARY_NO_CLINIC_JWT);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_WITH_CPF
    );
    mockBuildPatientResponseDbCalls();

    const resolveCallerClinicIdMock = resolveCallerClinicId as ReturnType<typeof vi.fn>;
    resolveCallerClinicIdMock.mockResolvedValueOnce(7);

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(resolveCallerClinicId).toHaveBeenCalledWith(
      SECRETARY_NO_CLINIC_JWT.user,
      undefined
    );
    expect(db.insert).toHaveBeenCalled();
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues.clinicId).toBe(7);
    expect(insertedValues.accessorRole).toBe("secretaria");
    expect(res.body).not.toHaveProperty("cpf");
    expect(insertedValues.fieldsAccessed).toEqual([]);
  });

  it("does NOT fire a data_access_log insert when a doctor is unassigned from the patient (ensurePatientAccess returns null)", async () => {
    // Simulate a doctor who was later removed from the patient's care team.
    // ensurePatientAccess must return null, the handler must respond 404,
    // and db.insert must never be called — so no spurious audit record is written.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());

    const res = await request(buildApp()).get("/patients/5");

    // Allow any fire-and-forget microtasks to settle
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(404);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("resolves clinicId via resolveCallerClinicId when authResult.clinicId is absent (JWT without clinic claim)", async () => {
    // Reproduce the real-world scenario: clinic_owner logs in via the standard
    // POST /auth/login endpoint — the JWT does NOT carry a clinicId claim, so
    // authResult.clinicId is undefined. The handler must call resolveCallerClinicId
    // to stamp the correct clinic on the audit record; without this fix the row
    // would be inserted with clinicId=null and become invisible to the owner via
    // GET /clinics/me/access-logs (which filters by resolved clinicId).
    const OWNER_NO_CLINIC_JWT = {
      user: { ...DOCTOR_AUTH.user, id: 21, role: "clinic_owner" as const },
      // clinicId intentionally absent — mirrors JWT without clinicId claim
    };

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_NO_CLINIC_JWT);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      PATIENT_ROW_WITH_CPF
    );
    mockBuildPatientResponseDbCalls();

    const resolveCallerClinicIdMock = resolveCallerClinicId as ReturnType<typeof vi.fn>;
    resolveCallerClinicIdMock.mockResolvedValueOnce(42);

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await request(buildApp()).get("/patients/5");

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(resolveCallerClinicId).toHaveBeenCalledWith(
      OWNER_NO_CLINIC_JWT.user,
      undefined
    );
    expect(db.insert).toHaveBeenCalled();
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues.clinicId).toBe(42);
    expect(insertedValues.accessorRole).toBe("clinic_owner");
    expect(insertedValues.fieldsAccessed).toContain("cpf");
  });
});

// ── writeDataAccessLog — retry logic ─────────────────────────────────────────

describe("writeDataAccessLog — retry and failure handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupDoctorRequest(app: ReturnType<typeof buildAppWithLog>["app"]) {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
    mockBuildPatientResponseDbCalls();
    return request(app).get("/patients/5");
  }

  it("inserts exactly one row when the first attempt succeeds", async () => {
    const { app } = buildAppWithLog();

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);

    const res = await setupDoctorRequest(app);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.values.mock.calls[0][0]).toMatchObject({
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
      clinicId: 1,
    });
    expect(insertChain.values.mock.calls[0][0].fieldsAccessed).toContain("cpf");
  });

  it("retries after a transient DB error and inserts the row on the second attempt", async () => {
    vi.useFakeTimers();

    const { app, log } = buildAppWithLog();

    const failChain = makeRejectInsertChain(new Error("Connection timeout"));
    const successChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(failChain)
      .mockReturnValue(successChain);

    const res = await setupDoctorRequest(app);

    // Let the first attempt fail and the retry setTimeout be scheduled
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    expect(db.insert).toHaveBeenCalledTimes(2);
    // No error logged — second attempt succeeded
    expect(log.error).not.toHaveBeenCalled();
    // The successful second attempt carried the correct payload
    expect(successChain.values.mock.calls[0][0]).toMatchObject({
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
    });
    expect(successChain.values.mock.calls[0][0].fieldsAccessed).toContain("cpf");
  });

  it("logs a structured error with audit_failure: true when both attempts fail (total DB outage)", async () => {
    // This test covers the worst case: ALL inserts reject (dataAccessLog +
    // auditFailures + staffEvents). The handler must still return 200 and log
    // three structured errors — one primary audit-failure log and one for each
    // inner catch block.
    vi.useFakeTimers();

    const { app, log } = buildAppWithLog();

    const dbError = new Error("Persistent DB failure");
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(
      makeRejectInsertChain(dbError)
    );

    const res = await setupDoctorRequest(app);

    // Advance past both dataAccessLog attempts (first fails immediately, second after 500ms)
    await vi.advanceTimersByTimeAsync(600);

    // (c) patient response is unaffected
    expect(res.status).toBe(200);

    // dataAccessLog × 2 + auditFailures × 1 + staffEvents × 1 = 4 total inserts
    expect(db.insert).toHaveBeenCalledTimes(4);

    // Multiple log.error calls expected: primary audit failure + auditFailures catch +
    // staffEvents catch + owner-lookup catch (db.select undefined → TypeError).
    // Use .find() to locate the primary audit-failure entry regardless of call order.
    expect(log.error).toHaveBeenCalled();
    const auditFailureCall = log.error.mock.calls.find(
      ([obj]: [any]) => obj?.audit_failure === true
    );
    expect(auditFailureCall).toBeDefined();
    const [logObj, logMsg] = auditFailureCall!;
    expect(logObj).toMatchObject({
      audit_failure: true,
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
      clinicId: 1,
    });
    expect(logObj.err).toBe(dbError);
    expect(logObj.fieldsAccessed).toContain("cpf");
    expect(logMsg).toMatch(/LGPD audit write failed after all retries/);

    // Second error: auditFailures insert failed
    expect(log.error.mock.calls[1][1]).toMatch(/Failed to persist audit failure record/);

    // Third error: staffEvents insert failed
    expect(log.error.mock.calls[2][1]).toMatch(/Failed to create staff event for audit failure/);
  });

  it("writes the failure record to auditFailuresTable when both dataAccessLog inserts fail", async () => {
    // (a) Verifies the failure record IS written to audit_failures when the
    // main dataAccessLogTable is temporarily unavailable.
    vi.useFakeTimers();

    const { app } = buildAppWithLog();

    const dbError = new Error("dataAccessLog table unavailable");
    const auditFailureChain = makeInsertChain();
    const staffEventChain = makeInsertChain();

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // first dataAccessLog attempt
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // second dataAccessLog attempt (retry)
      .mockReturnValueOnce(auditFailureChain)              // auditFailuresTable — succeeds
      .mockReturnValueOnce(staffEventChain);               // staffEventsTable — succeeds

    const res = await setupDoctorRequest(app);
    await vi.advanceTimersByTimeAsync(600);

    // (c) patient response still returns normally
    expect(res.status).toBe(200);

    // (a) auditFailuresTable was inserted with the correct payload
    expect(auditFailureChain.values).toHaveBeenCalledTimes(1);
    const auditPayload = auditFailureChain.values.mock.calls[0][0];
    expect(auditPayload).toMatchObject({
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
      clinicId: 1,
      errorMessage: dbError.message,
    });
    expect(auditPayload.fieldsAccessed).toContain("cpf");
  });

  it("creates a staffEvent when both dataAccessLog inserts fail and clinicId is set", async () => {
    // (b) Verifies a staff event of type 'audit_write_failure' is created so
    // clinic owners can see the compliance alert in the activity feed.
    vi.useFakeTimers();

    const { app } = buildAppWithLog();

    const dbError = new Error("dataAccessLog table unavailable");
    const auditFailureChain = makeInsertChain();
    const staffEventChain = makeInsertChain();

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // first dataAccessLog attempt
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // second dataAccessLog attempt (retry)
      .mockReturnValueOnce(auditFailureChain)              // auditFailuresTable — succeeds
      .mockReturnValueOnce(staffEventChain);               // staffEventsTable — succeeds

    const res = await setupDoctorRequest(app);
    await vi.advanceTimersByTimeAsync(600);

    // (c) patient response still returns normally
    expect(res.status).toBe(200);

    // (b) staffEventsTable was inserted with the correct payload
    expect(staffEventChain.values).toHaveBeenCalledTimes(1);
    const eventPayload = staffEventChain.values.mock.calls[0][0];
    expect(eventPayload).toMatchObject({
      userId: DOCTOR_AUTH.user.id,
      clinicId: 1,
      type: "audit_write_failure",
    });
    expect(typeof eventPayload.description).toBe("string");
    expect(eventPayload.description.length).toBeGreaterThan(0);
  });

  it("does NOT create a staffEvent when clinicId is absent on the failing audit entry", async () => {
    // The staffEvents insert is guarded by `if (logEntry.clinicId)` — confirm
    // it is skipped entirely (rather than inserting a null-clinicId row) when
    // the caller has no resolved clinic, preventing a FK violation.
    vi.useFakeTimers();

    const { app, log } = buildAppWithLog();

    // Use a patient caller — clinicId will be null on the auth result
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    mockBuildPatientResponseDbCalls();

    // Patient role: writeDataAccessLog is not called at all, so db.insert is
    // never triggered by the audit path. Just verify the response is clean.
    const successChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(successChain);

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    // Patient self-access never triggers the audit insert
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ── writeDataAccessLog — audit failure email alert ────────────────────────────

describe("writeDataAccessLog — audit failure email alert to clinic owners", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Sets up a doctor request that will fail all audit log retries for a given
   * clinicId. Also mocks the owner-lookup and branding selects that follow
   * the failure path.
   */
  function setupAuditFailureRequest(
    app: ReturnType<typeof buildAppWithLog>["app"],
    clinicId: number,
    owners: { email: string; name: string }[] = [{ email: "owner@clinic.dev", name: "Dono Clínica" }]
  ) {
    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(clinicId);

    const dbError = new Error("Persistent DB failure");
    const rejectChain = makeRejectInsertChain(dbError);
    const successChain = makeInsertChain();

    // db.insert: fail twice (retries), then succeed for auditFailures + staffEvents
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(rejectChain)
      .mockReturnValueOnce(rejectChain)
      .mockReturnValue(successChain);

    // db.select: 3 calls for buildPatientResponse, then owner lookup, then branding
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                  // weightEntries
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))      // xpEntries
      .mockReturnValueOnce(makeSelectChain([]))                  // patientDoctors (care team)
      .mockReturnValueOnce(makeSelectChain(owners))              // clinic owner lookup
      .mockReturnValue(makeSelectChain([{ clinicName: "Test Clinic" }])); // branding

    return request(app).get("/patients/5");
  }

  it("emails all clinic owners when both audit retries fail", async () => {
    vi.useFakeTimers();
    const { app } = buildAppWithLog();

    const res = await setupAuditFailureRequest(app, 501);
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@clinic.dev",
        ownerName: "Dono Clínica",
        accessorRole: DOCTOR_AUTH.user.role,
        accessorUserId: DOCTOR_AUTH.user.id,
        patientId: 5,
      })
    );
  });

  it("emails every owner when a clinic has multiple owners", async () => {
    vi.useFakeTimers();
    const { app } = buildAppWithLog();
    const multipleOwners = [
      { email: "owner1@clinic.dev", name: "Dono Um" },
      { email: "owner2@clinic.dev", name: "Dono Dois" },
    ];

    const res = await setupAuditFailureRequest(app, 502, multipleOwners);
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(2);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner1@clinic.dev" })
    );
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner2@clinic.dev" })
    );
  });

  it("suppresses the alert email within the one-hour cooldown window", async () => {
    vi.useFakeTimers();
    const { app } = buildAppWithLog();

    // First failure — should trigger email (clinicId=503, no prior cooldown entry)
    const res1 = await setupAuditFailureRequest(app, 503);
    await vi.advanceTimersByTimeAsync(600);
    expect(res1.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(1);

    // Second failure for the same clinic within the cooldown window — no email
    const res2 = await setupAuditFailureRequest(app, 503);
    await vi.advanceTimersByTimeAsync(600);
    expect(res2.status).toBe(200);
    expect(sendAuditFailureAlertEmail).not.toHaveBeenCalled();
  });

  it("re-sends the alert after the cooldown window expires", async () => {
    vi.useFakeTimers();
    const { app } = buildAppWithLog();

    // First failure — email sent (clinicId=504)
    const res1 = await setupAuditFailureRequest(app, 504);
    await vi.advanceTimersByTimeAsync(600);
    expect(res1.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(1);

    // Advance past the 1-hour cooldown
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1);

    // Second failure after cooldown — email sent again
    const res2 = await setupAuditFailureRequest(app, 504);
    await vi.advanceTimersByTimeAsync(600);
    expect(res2.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send an email when the audit log write succeeds", async () => {
    vi.useFakeTimers();
    const { app } = buildAppWithLog();

    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(505);

    const successChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(successChain);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValue(makeSelectChain([]));

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    expect(sendAuditFailureAlertEmail).not.toHaveBeenCalled();
  });

  it("does not send a duplicate email when ownerNotifiedAt is already set on the failure row", async () => {
    // Reproduces the background-retry / server-restart scenario: the
    // auditFailuresTable row already has ownerNotifiedAt stamped from a prior
    // dispatch attempt. The guard must read the row and bail out before calling
    // sendAuditFailureAlertEmail a second time.
    //
    // Uses clinicId=506 (unique to this test) to avoid the module-level
    // auditAlertCooldownL1 Map carrying over a cooldown from a prior test run.
    vi.useFakeTimers();
    const { app } = buildAppWithLog();

    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(506);

    const dbError = new Error("dataAccessLog unavailable");

    // auditFailures insert returns a row with id=99 so auditFailureId is non-null
    const auditFailureChain = makeInsertChain([{ id: 99 }]);
    const staffEventChain = makeInsertChain();

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // first dataAccessLog attempt
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // second dataAccessLog attempt (retry)
      .mockReturnValueOnce(auditFailureChain)              // auditFailuresTable — succeeds with id=99
      .mockReturnValueOnce(staffEventChain);               // staffEventsTable — succeeds

    // db.select: 3 calls for buildPatientResponse, then the ownerNotifiedAt guard check
    // which returns a non-null timestamp — meaning the owner was already notified.
    const alreadyNotifiedAt = new Date();
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                                        // weightEntries
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))                            // xpEntries
      .mockReturnValueOnce(makeSelectChain([]))                                        // patientDoctors
      .mockReturnValueOnce(makeSelectChain([{ ownerNotifiedAt: alreadyNotifiedAt }])); // guard: already set

    // No cooldown DB lookup because the guard returns before reaching that code
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    // The guard must have fired and blocked the email dispatch entirely
    expect(sendAuditFailureAlertEmail).not.toHaveBeenCalled();
  });

  it("still sends an email when ownerNotifiedAt is null on the failure row (normal first-time dispatch)", async () => {
    // Confirms the guard does NOT block the email when the row has not yet
    // been notified — i.e., ownerNotifiedAt IS NULL — which is the normal path.
    //
    // Uses clinicId=507 (unique to this test) to avoid cooldown bleed from other tests.
    vi.useFakeTimers();
    const { app } = buildAppWithLog();

    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(507);

    const dbError = new Error("dataAccessLog unavailable");

    // auditFailures insert returns id=88 so auditFailureId is non-null
    const auditFailureChain = makeInsertChain([{ id: 88 }]);
    const staffEventChain = makeInsertChain();

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError))
      .mockReturnValueOnce(makeRejectInsertChain(dbError))
      .mockReturnValueOnce(auditFailureChain)
      .mockReturnValueOnce(staffEventChain);

    // db.update for ownerNotifiedAt after sending (called with isNull guard in WHERE)
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    // db.select: 3 for buildPatientResponse, 1 for ownerNotifiedAt guard (null → proceed),
    // 1 for owner lookup, then branding (falls through to catchall)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                               // weightEntries
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))                   // xpEntries
      .mockReturnValueOnce(makeSelectChain([]))                               // patientDoctors
      .mockReturnValueOnce(makeSelectChain([{ ownerNotifiedAt: null }]))      // guard: null → proceed
      .mockReturnValueOnce(makeSelectChain([{ email: "owner@clinic.dev", name: "Dono" }])) // owner lookup
      .mockReturnValue(makeSelectChain([{ clinicName: "Test Clinic" }]));     // branding

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@clinic.dev", ownerName: "Dono" })
    );
  });

  it("logs the email send failure when sendAuditFailureAlertEmail throws (email service down)", async () => {
    // Double-failure scenario: audit write fails (both retries) AND the alert email
    // also throws (e.g. Resend API is down). The handler must:
    // (a) still return 200 — the patient response is never affected,
    // (b) log the original audit failure with audit_failure: true,
    // (c) log a separate error for the email send failure, including the recipient address.
    vi.useFakeTimers();
    const { app, log } = buildAppWithLog();

    vi.resetAllMocks();

    const emailError = new Error("Resend API unavailable");
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockRejectedValue(emailError);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(601);

    const dbError = new Error("Persistent DB failure");
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // first dataAccessLog attempt
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // second dataAccessLog attempt (retry)
      .mockReturnValue(makeInsertChain());                 // auditFailures + staffEvents succeed

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                                       // weightEntries
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))                           // xpEntries
      .mockReturnValueOnce(makeSelectChain([]))                                       // patientDoctors
      .mockReturnValueOnce(makeSelectChain([{ email: "owner@clinic.dev", name: "Dono Clínica" }])) // owner lookup
      .mockReturnValue(makeSelectChain([{ clinicName: "Test Clinic" }]));             // branding

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    // (a) patient response is unaffected
    expect(res.status).toBe(200);

    // (b) original audit failure is logged
    const auditFailureCall = log.error.mock.calls.find(
      ([obj]: [any]) => obj?.audit_failure === true
    );
    expect(auditFailureCall).toBeDefined();
    expect(auditFailureCall![0]).toMatchObject({
      audit_failure: true,
      accessorUserId: DOCTOR_AUTH.user.id,
      accessorRole: "profissional_saude",
      patientId: 5,
      clinicId: 601,
    });
    expect(auditFailureCall![1]).toMatch(/LGPD audit write failed after all retries/);

    // (c) email send failure is also logged with the recipient address
    const emailFailureCall = log.error.mock.calls.find(
      ([obj, msg]: [any, string]) =>
        typeof msg === "string" && msg.includes("Failed to send audit failure alert email to owner")
    );
    expect(emailFailureCall).toBeDefined();
    expect(emailFailureCall![0]).toMatchObject({
      err: emailError,
      to: "owner@clinic.dev",
    });
  });

  it("logs the lookup error with clinicId and does NOT send any email when the owner-lookup db.select itself rejects", async () => {
    // Nested-failure scenario: the audit write fails (both retries), and then the
    // db.select that fetches clinic owners also throws (e.g. separate DB timeout).
    // The outer catch(lookupErr) block must:
    // (a) still return 200 — the patient response is unaffected,
    // (b) call log.error with the lookup error and the clinicId so it is traceable,
    // (c) NOT call sendAuditFailureAlertEmail — no owners were resolved.
    vi.useFakeTimers();
    const { app, log } = buildAppWithLog();

    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(603);

    const dbError = new Error("Persistent DB failure");
    const lookupErr = new Error("DB timeout during owner lookup");

    // db.insert: fail twice (dataAccessLog retries), then succeed for auditFailures + staffEvents
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // first dataAccessLog attempt
      .mockReturnValueOnce(makeRejectInsertChain(dbError)) // second dataAccessLog attempt (retry)
      .mockReturnValue(makeInsertChain());                 // auditFailures + staffEvents succeed

    // db.select: 3 for buildPatientResponse, then the owner lookup which rejects
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                 // weightEntries
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))    // xpEntries
      .mockReturnValueOnce(makeSelectChain([]))                 // patientDoctors (care team)
      .mockReturnValueOnce(makeRejectSelectChain(lookupErr));   // owner lookup — rejects

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    // (a) patient response is unaffected
    expect(res.status).toBe(200);

    // (b) log.error must include the lookup error and clinicId
    const lookupFailCall = log.error.mock.calls.find(
      ([obj, msg]: [any, string]) =>
        typeof msg === "string" && msg.includes("Failed to look up clinic owners for audit failure alert email")
    );
    expect(lookupFailCall).toBeDefined();
    expect(lookupFailCall![0]).toMatchObject({
      err: lookupErr,
      clinicId: 603,
    });

    // (c) no email was sent because no owners were resolved
    expect(sendAuditFailureAlertEmail).not.toHaveBeenCalled();
  });

  it("logs both audit failure and email failure for each owner when multiple owners exist and email service is down", async () => {
    // With two owners and a failing email service, both sends are attempted (no
    // short-circuit), and each failure is independently logged — the second owner
    // must not be silently skipped because the first send threw.
    vi.useFakeTimers();
    const { app, log } = buildAppWithLog();

    vi.resetAllMocks();

    const emailError = new Error("Resend 503 Service Unavailable");
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockRejectedValue(emailError);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_ROW_WITH_CPF);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(602);

    const dbError = new Error("Persistent DB failure");
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError))
      .mockReturnValueOnce(makeRejectInsertChain(dbError))
      .mockReturnValue(makeInsertChain());

    const twoOwners = [
      { email: "owner1@clinic.dev", name: "Dono Um" },
      { email: "owner2@clinic.dev", name: "Dono Dois" },
    ];

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain(twoOwners))
      .mockReturnValue(makeSelectChain([{ clinicName: "Test Clinic" }]));

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);

    // sendAuditFailureAlertEmail was called once per owner
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(2);

    // Both send failures are individually logged
    const emailFailureCalls = log.error.mock.calls.filter(
      ([_obj, msg]: [any, string]) =>
        typeof msg === "string" && msg.includes("Failed to send audit failure alert email to owner")
    );
    expect(emailFailureCalls).toHaveLength(2);

    const loggedRecipients = emailFailureCalls.map(([obj]: [any]) => obj.to);
    expect(loggedRecipients).toContain("owner1@clinic.dev");
    expect(loggedRecipients).toContain("owner2@clinic.dev");

    // The original audit failure is also present in the log
    const auditFailureCall = log.error.mock.calls.find(
      ([obj]: [any]) => obj?.audit_failure === true
    );
    expect(auditFailureCall).toBeDefined();
    expect(auditFailureCall![1]).toMatch(/LGPD audit write failed after all retries/);
  });
});
