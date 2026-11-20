import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

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
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(() => ({ userId: null })),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
}));

vi.mock("../../lib/email", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_new_pw"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  signAccessToken: vi.fn().mockResolvedValue("jwt_token"),
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { sendPasswordResetEmail } from "../../lib/email";
import authRouter from "../auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  return app;
}

/**
 * Drizzle select chain: select().from().where().limit() → resolves to `data`
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
 * Drizzle delete chain: delete().where() → resolves
 */
function makeDeleteChain(): any {
  const chain: any = {};
  chain.where = vi.fn().mockResolvedValue([]);
  return chain;
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const STAFF_USER = {
  id: 1,
  email: "maria@clinica.dev",
  name: "Maria Profissional",
  role: "profissional_saude" as const,
  clerkId: null,
  passwordHash: "some_hash",
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  appleUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const OWNER_USER = {
  ...STAFF_USER,
  id: 2,
  email: "carlos@clinica.dev",
  name: "Carlos Dono",
  role: "clinic_owner" as const,
};

const PATIENT_USER = {
  ...STAFF_USER,
  id: 3,
  email: "ana@paciente.dev",
  name: "Ana Paciente",
  role: "patient" as const,
};

// ── POST /auth/forgot-password ────────────────────────────────────────────────

describe("POST /auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and calls sendPasswordResetEmail for a valid staff email", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([STAFF_USER]))
      .mockReturnValueOnce(makeSelectChain([]));

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    const res = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "maria@clinica.dev" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();

    const emailArgs = (sendPasswordResetEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(emailArgs.to).toBe("maria@clinica.dev");
    expect(emailArgs.name).toBe("Maria Profissional");
    expect(typeof emailArgs.resetUrl).toBe("string");
    expect(emailArgs.resetUrl).toContain("/reset-password?token=");
    expect(emailArgs.resetUrl.split("token=")[1]).toHaveLength(64);
  });

  it("returns 200 and does NOT send email for an unknown email (no enumeration leak)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "unknown@nobody.com" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    // No DB writes — no reset token should be inserted for an unknown email
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns 200 and does NOT send email for a patient email (no enumeration leak)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([PATIENT_USER])
    );

    const res = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "ana@paciente.dev" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    // No DB writes — patients are excluded from password reset; no token should be inserted
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("repeated calls for an unknown email always return identical 200 with no DB side-effects", async () => {
    const app = buildApp();
    const genericBody = { success: true };

    for (let i = 0; i < 3; i++) {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "ghost@nobody.com" });

      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(genericBody);
    }

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("repeated calls for a patient email always return identical 200 with no DB side-effects", async () => {
    const app = buildApp();
    const genericBody = { success: true };

    for (let i = 0; i < 3; i++) {
      (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        makeSelectChain([PATIENT_USER])
      );

      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "ana@paciente.dev" });

      await new Promise<void>((resolve) => setImmediate(resolve));

      expect(res.status).toBe(200);
      expect(res.body).toEqual(genericBody);
    }

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("returns 200 and does NOT send email when the request body is invalid (no enumeration leak)", async () => {
    const res = await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "not-an-email" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("stores a SHA-256 hash of the token (not the raw token) in the database", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([OWNER_USER]))
      .mockReturnValueOnce(makeSelectChain([]));

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "carlos@clinica.dev" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(insertChain.values).toHaveBeenCalledOnce();
    const insertedValues = insertChain.values.mock.calls[0][0];

    const emailArgs = (sendPasswordResetEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const rawToken = emailArgs.resetUrl.split("token=")[1];

    const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    expect(insertedValues.tokenHash).toBe(expectedHash);
    expect(insertedValues.tokenHash).not.toBe(rawToken);
  });

  it("sets token expiry to approximately 1 hour from now", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([STAFF_USER]))
      .mockReturnValueOnce(makeSelectChain([]));

    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    const before = Date.now();
    await request(buildApp())
      .post("/auth/forgot-password")
      .send({ email: "maria@clinica.dev" });

    const insertedValues = insertChain.values.mock.calls[0][0];
    const expiresAt: Date = insertedValues.expiresAt;

    expect(expiresAt).toBeInstanceOf(Date);
    const msUntilExpiry = expiresAt.getTime() - before;
    expect(msUntilExpiry).toBeGreaterThan(59 * 60 * 1000);
    expect(msUntilExpiry).toBeLessThan(61 * 60 * 1000);
  });
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────

describe("POST /auth/reset-password", () => {
  const RAW_TOKEN = "a".repeat(64);
  const TOKEN_HASH = crypto.createHash("sha256").update(RAW_TOKEN).digest("hex");

  const VALID_RESET_TOKEN = {
    id: 42,
    userId: 1,
    tokenHash: TOKEN_HASH,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and updates the password for a valid, unexpired token", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([VALID_RESET_TOKEN])
    );

    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: RAW_TOKEN, newPassword: "NovaSenh@123" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(db.update).toHaveBeenCalledTimes(2);

    const firstUpdate = updateChain.set.mock.calls[0][0];
    expect(firstUpdate).toMatchObject({ isTemporaryPassword: false });

    const secondUpdate = updateChain.set.mock.calls[1][0];
    expect(secondUpdate).toHaveProperty("usedAt");
    expect(secondUpdate.usedAt).toBeInstanceOf(Date);
  });

  it("returns 400 with clear error when the token does not exist in the database", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: "deadbeef".repeat(8), newPassword: "SomePass1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido|utilizado/i);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 400 with clear error when the token has already been used", async () => {
    // The handler queries WHERE tokenHash = ? AND usedAt IS NULL, so a used token is
    // excluded at the DB level. The mock returns [] to simulate this DB filter.
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: RAW_TOKEN, newPassword: "SomePass1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inválido|utilizado/i);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 400 with clear error when the token is expired", async () => {
    const expiredToken = {
      ...VALID_RESET_TOKEN,
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([expiredToken])
    );

    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: RAW_TOKEN, newPassword: "SomePass1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expirou/i);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: RAW_TOKEN, newPassword: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/senha deve ter pelo menos 8/i);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 400 when token field is missing", async () => {
    const res = await request(buildApp())
      .post("/auth/reset-password")
      .send({ newPassword: "ValidPass1" });

    expect(res.status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("marks the token as used after a successful reset", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([VALID_RESET_TOKEN])
    );

    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    await request(buildApp())
      .post("/auth/reset-password")
      .send({ token: RAW_TOKEN, newPassword: "NewPassw0rd" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    const usedAtUpdate = updateChain.set.mock.calls[1][0];
    expect(usedAtUpdate).toHaveProperty("usedAt");
    expect(usedAtUpdate.usedAt).toBeInstanceOf(Date);
  });
});
