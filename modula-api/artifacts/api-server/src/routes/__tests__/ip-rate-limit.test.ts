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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
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
const IP_LIMIT = 10;

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
 * Set up a request where the IP limit fires (ipCount >= IP_LIMIT).
 * db.select order:
 *   1. users lookup   → [PATIENT_USER]
 *   2. IP count       → [{ total: ipCount }]  → triggers 429
 */
function setupIpBlockedRequest(ipCount = IP_LIMIT) {
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
    .mockReturnValueOnce(makeSelectChain([{ total: ipCount }]));
}

/**
 * Set up a request where both IP and email limits pass.
 * db.select order:
 *   1. users lookup   → [PATIENT_USER]
 *   2. IP count       → [{ total: ipCount }]  (below limit)
 *   3. email count    → [{ total: 0 }]  (below limit)
 *   4. clinicSettings → []
 */
function setupPassingRequest(ipCount: number) {
  (db.select as ReturnType<typeof vi.fn>)
    .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
    .mockReturnValueOnce(makeSelectChain([{ total: ipCount }]))
    .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
    .mockReturnValueOnce(makeSelectChain([]));

  (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
  (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IP rate limit — /auth/request-access and /auth/resend-access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("blocks request-access when IP count reaches the limit (returns 429)", async () => {
    setupIpBlockedRequest(IP_LIMIT);

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/muitas tentativas/i);
  });

  it("blocks resend-access when IP count reaches the limit (returns 429)", async () => {
    setupIpBlockedRequest(IP_LIMIT);

    const res = await request(buildApp())
      .post("/auth/resend-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/muitas tentativas/i);
  });

  it("blocks when IP count exceeds the limit", async () => {
    setupIpBlockedRequest(IP_LIMIT + 5);

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(429);
  });

  it("allows through when IP count is one below the limit", async () => {
    setupPassingRequest(IP_LIMIT - 1);

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(200);
  });

  it("IP limit fires independently of the email limit — email at 0, IP blocked", async () => {
    setupIpBlockedRequest(IP_LIMIT);

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    expect(res.status).toBe(429);
    // The email rate-limit query was never reached — no insert occurred
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does not consume the email quota or update the password when IP is blocked", async () => {
    setupIpBlockedRequest(IP_LIMIT);

    await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("IP limit and email limit use the same generic 429 error message", async () => {
    // IP blocked
    setupIpBlockedRequest(IP_LIMIT);
    const ipBlockedRes = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    vi.resetAllMocks();

    // Email blocked (IP passes, email count at limit)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_USER]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))   // IP passes
      .mockReturnValueOnce(makeSelectChain([{ total: 3 }]));  // email blocked

    const emailBlockedRes = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: PATIENT_EMAIL });

    expect(ipBlockedRes.status).toBe(429);
    expect(emailBlockedRes.status).toBe(429);
    expect(ipBlockedRes.body.error).toBe(emailBlockedRes.body.error);
  });

  it("IP check runs after user lookup — unknown emails bypass both limits entirely", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValue(makeSelectChain([])); // users lookup returns empty

    const res = await request(buildApp())
      .post("/auth/request-access")
      .send({ email: "unknown@ninguem.dev" });

    expect(res.status).toBe(200);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
