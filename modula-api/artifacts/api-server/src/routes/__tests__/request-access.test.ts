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
  doctorsTable: {},
  staffEventsTable: {},
  clinicSettingsTable: {},
  passwordResetTokensTable: {},
  patientClinicsTable: {},
  clinicsTable: {},
  clinicOwnersTable: {},
  PLAN_LABELS: {},
  refreshTokensTable: {},
  requestAccessAttemptsTable: {},
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(() => ({ userId: null })),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  resolveOwnerClinicId: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_temp_pw"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  signAccessToken: vi.fn().mockResolvedValue("jwt_token"),
  signClinicScopedToken: vi.fn().mockResolvedValue("clinic_scoped_token"),
  generateRefreshToken: vi.fn().mockReturnValue("raw_refresh"),
  hashRefreshToken: vi.fn().mockReturnValue("hashed_refresh"),
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { sendTempPasswordEmail } from "../../lib/email";
import { hashPassword, verifyPassword, signAccessToken } from "../../lib/jwt";
import authRouter from "../auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  // Inject a no-op req.log so route handlers that call req.log.warn/info don't throw
  app.use((_req: any, _res: any, next: any) => {
    _req.log = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  });
  app.use(authRouter);
  return app;
}

/**
 * Drizzle select chain: select().from().where().limit() → resolves to `data`.
 * Also thenable so `await select().from().where()` works without .limit().
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
 * Drizzle update chain: update().set().where() → resolves
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
 * Drizzle insert chain: insert().values() → resolves
 */
function makeInsertChain(): any {
  const chain: any = {};
  chain.values = vi.fn().mockResolvedValue([]);
  return chain;
}

/**
 * Drizzle delete chain: delete().where() → resolves (with .catch for background purge)
 */
function makeDeleteChain(): any {
  const chain: any = {};
  chain.where = vi.fn().mockResolvedValue([]);
  return chain;
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const PATIENT_USER = {
  id: 10,
  email: "ana@paciente.dev",
  name: "Ana Paciente",
  role: "patient" as const,
  clerkId: null,
  passwordHash: "some_old_hash",
  isTemporaryPassword: false,
  temporaryPasswordExpiresAt: null,
  avatarUrl: null,
  deactivatedAt: null,
  appleUserId: null,
  cpf: null,
  rg: null,
  phone: null,
  birthDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const STAFF_USER = {
  ...PATIENT_USER,
  id: 20,
  email: "maria@gmail.com",
  name: "Maria Profissional",
  role: "profissional_saude" as const,
};

const CLINIC_SETTINGS = {
  id: 1,
  clinicName: "KLIE Saúde",
  senderName: "KLIE",
  fromEmail: "no-reply@klie.dev",
  replyToEmail: "contato@klie.dev",
};

// ── POST /auth/request-access ─────────────────────────────────────────────────

describe("POST /auth/request-access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (sendTempPasswordEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (hashPassword as ReturnType<typeof vi.fn>).mockResolvedValue("hashed_temp_pw");
  });

  it("returns 200 and calls sendTempPasswordEmail for a known patient email", async () => {
    // 1st select: user lookup
    // IP count, email count, then clinic branding.
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([CLINIC_SETTINGS]));

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "ana@paciente.dev" });

    // Allow background delete to settle
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);

    expect(sendTempPasswordEmail).toHaveBeenCalledOnce();

    const emailArgs = (sendTempPasswordEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(emailArgs.to).toBe("ana@paciente.dev");
    expect(emailArgs.name).toBe("Ana Paciente");
    expect(typeof emailArgs.tempPassword).toBe("string");
    expect(emailArgs.tempPassword).toMatch(/^\d{6}$/);
    expect(emailArgs.clinicName).toBe("KLIE Saúde");
  });

  it("returns 200 and does NOT send email for an unknown email (no enumeration leak)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "nobody@unknown.com" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("returns 200 and does NOT send email for a staff/non-patient email (no enumeration leak)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([STAFF_USER]));

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "maria@gmail.com" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limit is exceeded for a known patient email", async () => {
    // IP limit passes; per-email count reaches REQUEST_ACCESS_MAX.
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 3 }]));

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "ana@paciente.dev" });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/muitas tentativas/i);
    // No attempt was recorded and no email was sent
    expect(db.insert).not.toHaveBeenCalled();
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email format", async () => {
    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
    expect(sendTempPasswordEmail).not.toHaveBeenCalled();
  });

  it("returns 200 even when sendTempPasswordEmail throws (graceful fallback)", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([CLINIC_SETTINGS]));

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    (sendTempPasswordEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("SMTP connection refused")
    );

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "ana@paciente.dev" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    // The handler catches the email error and still responds 200 — the patient
    // should not see a 500 just because the mail transport is down.
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);
  });

  it("updates the user's passwordHash, sets isTemporaryPassword=true and sets temporaryPasswordExpiresAt ~24h from now", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([CLINIC_SETTINGS]));

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const before = Date.now();
    await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "ana@paciente.dev" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(db.update).toHaveBeenCalledOnce();
    const setArgs = updateChain.set.mock.calls[0][0];
    expect(setArgs).toHaveProperty("passwordHash", "hashed_temp_pw");
    expect(setArgs).toHaveProperty("isTemporaryPassword", true);
    expect(setArgs.temporaryPasswordExpiresAt).toBeInstanceOf(Date);
    const expectedExpiry = before + 24 * 60 * 60 * 1000;
    expect(setArgs.temporaryPasswordExpiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
    expect(setArgs.temporaryPasswordExpiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 5000);
  });
});

// ── POST /auth/login — temporary password expiry ───────────────────────────────

describe("POST /auth/login — temporary password expiry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (signAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue("jwt_token");
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
  });

  const EXPIRED_TEMP_USER = {
    ...PATIENT_USER,
    passwordHash: "hashed_temp",
    isTemporaryPassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() - 1000), // 1 second in the past
    failedLoginCount: 0,
    lastFailedLoginAt: null,
    deletionRequestedAt: null,
    accessToken: null,
  };

  const VALID_TEMP_USER = {
    ...PATIENT_USER,
    passwordHash: "hashed_temp",
    isTemporaryPassword: true,
    temporaryPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
    failedLoginCount: 0,
    lastFailedLoginAt: null,
    deletionRequestedAt: null,
    accessToken: null,
  };

  it("returns 401 with expiry error when the temporary password has expired", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([EXPIRED_TEMP_USER]));

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "ana@paciente.dev", password: "123456" });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expirou/i);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns 200 when the temporary password has not yet expired", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([VALID_TEMP_USER]));

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "ana@paciente.dev", password: "123456" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("jwt_token");
    expect(verifyPassword).toHaveBeenCalledOnce();
  });

  it("does not reject a non-temporary password even if temporaryPasswordExpiresAt is somehow set", async () => {
    const normalUserWithStaleExpiry = {
      ...PATIENT_USER,
      passwordHash: "hashed_real",
      isTemporaryPassword: false,
      temporaryPasswordExpiresAt: new Date(Date.now() - 1000),
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      deletionRequestedAt: null,
      accessToken: null,
    };

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([normalUserWithStaleExpiry]));

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "ana@paciente.dev", password: "mypassword" });

    expect(res.status).toBe(200);
    expect(verifyPassword).toHaveBeenCalledOnce();
  });
});
