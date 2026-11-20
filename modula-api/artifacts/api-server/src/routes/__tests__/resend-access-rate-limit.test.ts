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
  doctorsTable: {},
  staffEventsTable: {},
  clinicSettingsTable: {},
  passwordResetTokensTable: {},
  patientClinicsTable: {},
  clinicsTable: {},
  clinicOwnersTable: {},
  refreshTokensTable: {},
  requestAccessAttemptsTable: {},
  PLAN_LABELS: {},
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
  signAccessToken: vi.fn().mockResolvedValue("access_token"),
  signClinicScopedToken: vi.fn().mockResolvedValue("clinic_token"),
  generateRefreshToken: vi.fn().mockReturnValue("raw_refresh"),
  hashRefreshToken: vi.fn().mockReturnValue("hashed_refresh"),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import authRouter from "../auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively walk any value to collect all Date instances found within it.
 * Used to extract the windowStart Date from a drizzle SQL expression without
 * depending on drizzle's internal object structure.
 */
function findDatesInObject(obj: unknown, visited = new Set<object>()): Date[] {
  if (obj instanceof Date) return [obj];
  if (!obj || typeof obj !== "object") return [];
  if (visited.has(obj)) return [];
  visited.add(obj);
  const results: Date[] = [];
  for (const val of Object.values(obj as Record<string, unknown>)) {
    results.push(...findDatesInObject(val, visited));
  }
  return results;
}

/**
 * Build a select chain for the rate-limit count query that calls whereSpy
 * before resolving, so callers can inspect the drizzle expression argument.
 */
function makeCountChainWithSpy(
  total: number,
  whereSpy: (expr: unknown) => void
): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn((expr: any) => {
    whereSpy(expr);
    return {
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve([{ total }]).then(onFulfilled, onRejected),
      catch: (h: any) => Promise.resolve([{ total }]).catch(h),
    };
  });
  return chain;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  return app;
}

/**
 * Drizzle select chain supporting both:
 *  - .select().from().where().limit()  → awaits limit()
 *  - .select().from().where()          → awaits the chain directly (via then/catch)
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

function makeInsertChain(): any {
  const chain: any = {};
  chain.values = vi.fn().mockResolvedValue([]);
  return chain;
}

function makeDeleteChain(): any {
  const chain: any = {};
  chain.where = vi.fn().mockResolvedValue([]);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve([]).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve([]).catch(handler);
  return chain;
}

function makeUpdateChain(): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn().mockResolvedValue([]);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve([]).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve([]).catch(handler);
  return chain;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATIENT_EMAIL = "paciente@teste.dev";

const PATIENT_USER = {
  id: 99,
  email: PATIENT_EMAIL,
  name: "Paciente Teste",
  role: "patient" as const,
  clerkId: null,
  passwordHash: "some_hash",
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  appleUserId: null,
  cpf: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Set up one successful resend-access call.
 *
 * db.select is called in order:
 *   1. users lookup       → [PATIENT_USER]
 *   2. IP count           → [{ total: 0 }]  (well below per-IP limit)
 *   3. email count        → [{ total: currentCount }]
 *   4. clinicSettings     → []  (after password update)
 *
 * db.insert records the new attempt.
 * db.delete purges stale rows (background, fire-and-forget).
 * db.update sets the temp password.
 */
function setupSuccessfulRequest(currentCount: number) {
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))            // users lookup
    .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))            // IP count
    .mockReturnValueOnce(makeSelectChain([{ total: currentCount }])) // email count
    .mockReturnValueOnce(makeSelectChain([]));                       // clinicSettings

  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
  (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
}

/**
 * Set up a rate-limited (4th) request — email limit reached.
 *
 * db.select is called in order:
 *   1. users lookup       → [PATIENT_USER]
 *   2. IP count           → [{ total: 0 }]  (IP not blocked)
 *   3. email count        → [{ total: emailTotal }]  → triggers 429
 */
function setupRateLimitedRequest(emailTotal = 3) {
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
    .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))            // IP count (passes)
    .mockReturnValueOnce(makeSelectChain([{ total: emailTotal }]));  // email count (blocks)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /auth/resend-access — rate limiter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first 3 requests within the 1-hour window", async () => {
    const app = buildApp();

    setupSuccessfulRequest(0);
    const res1 = await request(app)
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(1);
    const res2 = await request(app)
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(2);
    const res3 = await request(app)
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });

  it("blocks a 4th request within the same window with HTTP 429", async () => {
    const app = buildApp();

    setupSuccessfulRequest(0);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(1);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(2);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    await new Promise<void>((resolve) => setImmediate(resolve));

    // 4th attempt — count is now 3 in the window
    setupRateLimitedRequest(3);
    const res4 = await request(app)
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(res4.status).toBe(429);
    expect(res4.body.error).toMatch(/muitas tentativas/i);
  });

  it("returns 429 as soon as count reaches exactly 3 (boundary check)", async () => {
    setupRateLimitedRequest(3);

    const res = await request(buildApp())
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/muitas tentativas/i);
  });

  it("still blocks when count exceeds 3 (e.g. 5 rows somehow present)", async () => {
    setupRateLimitedRequest(5);

    const res = await request(buildApp())
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(429);
  });

  it("does not insert a new attempt row when the limit is already reached", async () => {
    setupRateLimitedRequest(3);

    await request(buildApp())
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(db.insert).not.toHaveBeenCalled();
  });

  it("does not update the user password when the limit is reached", async () => {
    setupRateLimitedRequest(3);

    await request(buildApp())
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(db.update).not.toHaveBeenCalled();
  });

  it("inserts a new attempt row on each allowed request", async () => {
    const app = buildApp();

    setupSuccessfulRequest(0);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(1);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(db.insert).toHaveBeenCalledTimes(2);
  });

  it("passes a windowStart of exactly (Date.now - 1 hour) to the gte predicate", async () => {
    const FIXED_NOW = 1_750_000_000_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);

    const whereSpy = vi.fn();

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))       // users lookup
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))       // IP count (passes)
      .mockReturnValueOnce(makeCountChainWithSpy(0, whereSpy))    // email count query
      .mockReturnValueOnce(makeSelectChain([]));                  // clinicSettings
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    await request(buildApp())
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(whereSpy).toHaveBeenCalledOnce();

    const expr = whereSpy.mock.calls[0][0];
    const dates = findDatesInObject(expr);
    expect(dates).toHaveLength(1);
    expect(dates[0].getTime()).toBe(FIXED_NOW - 3_600_000);
  });

  it("returns generic 200 for an unknown email and triggers no DB writes", async () => {
    const app = buildApp();

    // users lookup returns empty — email not found
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValue(makeSelectChain([]));

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/auth/resend-access")
        .send({ email: "ninguem@desconhecido.dev" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/receberá a senha/i);
    }

    // No attempt should have been inserted and no user record updated
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns the same generic 200 for every repetition with an unknown email (body identical)", async () => {
    const app = buildApp();

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValue(makeSelectChain([]));

    const bodies: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/auth/resend-access")
        .send({ email: "ghost@naoexiste.dev" });
      bodies.push(res.body);
    }

    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
  });

  it("returns generic 200 for a non-patient (doctor) email and triggers no DB writes", async () => {
    const DOCTOR_USER = {
      id: 42,
      email: "medico@clinica.dev",
      name: "Dr. Fulano",
      role: "profissional_saude" as const,
      clerkId: null,
      passwordHash: "some_hash",
      isTemporaryPassword: false,
      avatarUrl: null,
      deactivatedAt: null,
      appleUserId: null,
      cpf: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const app = buildApp();

    // users lookup returns a doctor on every call
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValue(makeSelectChain([DOCTOR_USER]));

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/auth/resend-access")
        .send({ email: DOCTOR_USER.email });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/receberá a senha/i);
    }

    // Rate-limit table must never have been touched
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns the same generic 200 for every repetition with a non-patient email (body identical)", async () => {
    const OWNER_USER = {
      id: 7,
      email: "dono@clinica.dev",
      name: "Carlos Dono",
      role: "clinic_owner" as const,
      clerkId: null,
      passwordHash: "hash",
      isTemporaryPassword: false,
      avatarUrl: null,
      deactivatedAt: null,
      appleUserId: null,
      cpf: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const app = buildApp();

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValue(makeSelectChain([OWNER_USER]));

    const bodies: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/auth/resend-access")
        .send({ email: OWNER_USER.email });
      bodies.push(res.body);
    }

    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
  });

  it("allows a request after the 1-hour window expires and the gte boundary advances past the old attempts", async () => {
    const T0 = 1_750_000_000_000;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);

    const app = buildApp();

    // --- Three requests at T0 ---
    setupSuccessfulRequest(0);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(1);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    setupSuccessfulRequest(2);
    await request(app).post("/auth/resend-access").send({ email: PATIENT_EMAIL });

    await new Promise<void>((resolve) => setImmediate(resolve));

    // Advance simulated wall-clock by 61 minutes.
    vi.setSystemTime(T0 + 61 * 60 * 1000);

    const whereSpy = vi.fn();

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))   // IP count (passes)
      .mockReturnValueOnce(makeCountChainWithSpy(0, whereSpy))  // email count
      .mockReturnValueOnce(makeSelectChain([]));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(app)
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/receberá a senha/i);

    expect(whereSpy).toHaveBeenCalledOnce();
    const expr = whereSpy.mock.calls[0][0];
    const dates = findDatesInObject(expr);
    expect(dates).toHaveLength(1);
    const capturedWindowStart = dates[0].getTime();
    const expectedWindowStart = T0 + 61 * 60 * 1000 - 60 * 60 * 1000; // T0 + 1min
    expect(capturedWindowStart).toBe(expectedWindowStart);
    expect(T0).toBeLessThan(capturedWindowStart);
  });
});
