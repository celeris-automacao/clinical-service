import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";

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
  hashPassword: vi.fn().mockResolvedValue("hashed_pw"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  signAccessToken: vi.fn().mockResolvedValue("new_access_token"),
  signClinicScopedToken: vi.fn().mockResolvedValue("clinic_scoped_token"),
  generateRefreshToken: vi.fn().mockReturnValue("raw_refresh_token"),
  hashRefreshToken: vi.fn().mockReturnValue("mock_refresh_hash_for_testing"),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { verifyPassword } from "../../lib/jwt";
import authRouter from "../auth";

// Matches the literal value returned by the hashRefreshToken mock above
const MOCK_REFRESH_HASH = "mock_refresh_hash_for_testing";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
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

function makeInsertChain(returnValue: unknown = []): any {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(returnValue).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(returnValue).catch(handler);
  return chain;
}

function makeUpdateChain(): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve([]).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve([]).catch(handler);
  return chain;
}

function makeDeleteChain(): any {
  const chain: any = {};
  chain.where = vi.fn().mockResolvedValue([]);
  return chain;
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const ACTIVE_USER = {
  id: 10,
  email: "test@clinica.dev",
  name: "Test User",
  role: "clinic_owner" as const,
  clerkId: null,
  passwordHash: "hashed_pw",
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  appleUserId: null,
  failedLoginCount: 0,
  lastFailedLoginAt: null,
  cpf: null,
  rg: null,
  phone: null,
  birthDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// tokenHash matches what hashRefreshToken mock returns (MOCK_REFRESH_HASH)
const STORED_REFRESH_TOKEN = {
  id: 1,
  userId: 10,
  tokenHash: MOCK_REFRESH_HASH,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date(),
};

// ── POST /auth/login — refresh token issuance ─────────────────────────────────

describe("POST /auth/login — refresh token issuance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets an httpOnly refresh_token cookie on successful login", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "Test1234!" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("test@clinica.dev");

    const rawCookies = res.headers["set-cookie"];
    const setCookie: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    const refreshCookie = setCookie.find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("Path=/api/auth");
  });

  it("inserts a hashed refresh token into the database on successful login", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    const insertChain = makeInsertChain();
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(insertChain);
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "Test1234!" });

    expect(db.insert).toHaveBeenCalled();
    const insertedValues = insertChain.values.mock.calls[0][0];
    expect(insertedValues).toHaveProperty("userId", ACTIVE_USER.id);
    expect(insertedValues).toHaveProperty("tokenHash", MOCK_REFRESH_HASH);
    expect(insertedValues).toHaveProperty("expiresAt");
    const msToExpiry = insertedValues.expiresAt.getTime() - Date.now();
    expect(msToExpiry).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(msToExpiry).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it("does NOT set a refresh cookie when credentials are wrong", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "WrongPass" });

    expect(res.status).toBe(401);
    const rawCookies1 = res.headers["set-cookie"];
    const setCookie: string[] = Array.isArray(rawCookies1) ? rawCookies1 : rawCookies1 ? [rawCookies1] : [];
    const refreshCookie = setCookie.find((c) => c.startsWith("refresh_token="));
    expect(refreshCookie).toBeUndefined();
  });

  it("does NOT set a refresh cookie for a deactivated account", async () => {
    const deactivated = { ...ACTIVE_USER, deactivatedAt: new Date() };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([deactivated])
    );

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "Test1234!" });

    expect(res.status).toBe(401);
    const rawCookies2 = res.headers["set-cookie"];
    const setCookie2: string[] = Array.isArray(rawCookies2) ? rawCookies2 : rawCookies2 ? [rawCookies2] : [];
    expect(setCookie2.find((c) => c.startsWith("refresh_token="))).toBeUndefined();
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────

describe("POST /auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes the refresh token in the database when a cookie is present", async () => {
    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp())
      .post("/auth/logout")
      .set("Cookie", "refresh_token=some_raw_token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.update).toHaveBeenCalled();
    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) })
    );
  });

  it("clears the refresh_token cookie in the response", async () => {
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/auth/logout")
      .set("Cookie", "refresh_token=some_raw_token");

    expect(res.status).toBe(200);
    const rawCookies = res.headers["set-cookie"];
    const setCookie: string[] = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
    const clearedCookie = setCookie.find((c) => c.startsWith("refresh_token="));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
  });

  it("succeeds with 200 even when no refresh cookie is present (no-op)", async () => {
    const res = await request(buildApp()).post("/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("e2e: a revoked token is rejected by /auth/refresh", async () => {
    const revokedToken = {
      ...STORED_REFRESH_TOKEN,
      revokedAt: new Date(),
    };

    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([revokedToken])
    );

    const res = await request(buildApp())
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=previously_valid_token");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });
});

// ── Stale refresh token cleanup ───────────────────────────────────────────────

describe("deleteStaleRefreshTokens (triggered on login)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls db.delete after a successful login (fire-and-forget cleanup)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "Test1234!" });

    // Allow the fire-and-forget microtask to settle
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(200);
    expect(db.delete).toHaveBeenCalled();
  });

  it("does NOT call db.delete when login fails (wrong password)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "WrongPass" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(401);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("cleanup targets expired/revoked rows via db.delete().where()", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const deleteChain = makeDeleteChain();
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(deleteChain);

    await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "Test1234!" });

    await new Promise<void>((resolve) => setImmediate(resolve));

    // The where clause must have been called (it holds the expired/revoked filter)
    expect(deleteChain.where).toHaveBeenCalled();
  });

  it("cleanup does not block the login response (response arrives before cleanup completes)", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([ACTIVE_USER])
    );
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain());
    (verifyPassword as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    // Simulate a slow delete that resolves after the response
    let deleteResolve: () => void;
    const slowDelete: any = {
      where: vi.fn().mockReturnValue(
        new Promise<void>((resolve) => { deleteResolve = resolve; })
      ),
    };
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue(slowDelete);

    const res = await request(buildApp())
      .post("/auth/login")
      .send({ email: "test@clinica.dev", password: "Test1234!" });

    // Response should arrive even though delete hasn't resolved yet
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");

    // Resolve the slow delete to avoid unhandled rejection
    deleteResolve!();
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
});

// ── POST /auth/refresh ────────────────────────────────────────────────────────

describe("POST /auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a new access token when the refresh cookie is valid", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([STORED_REFRESH_TOKEN]))
      .mockReturnValueOnce(makeSelectChain([ACTIVE_USER]));

    const res = await request(buildApp())
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=any_raw_token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token", "new_access_token");
  });

  it("returns 401 when no refresh cookie is present", async () => {
    const res = await request(buildApp()).post("/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/refresh token/i);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 401 when the refresh token is not found in the database", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([])
    );

    const res = await request(buildApp())
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=unknown_token");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  it("returns 401 when the refresh token is expired", async () => {
    const expired = {
      ...STORED_REFRESH_TOKEN,
      expiresAt: new Date(Date.now() - 1000),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([expired])
    );

    const res = await request(buildApp())
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=expired_token");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  it("returns 401 when the refresh token has been revoked", async () => {
    const revoked = {
      ...STORED_REFRESH_TOKEN,
      revokedAt: new Date(Date.now() - 60_000),
    };
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([revoked])
    );

    const res = await request(buildApp())
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=revoked_token");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  it("returns 401 when the user associated with the token has been deactivated", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([STORED_REFRESH_TOKEN]))
      .mockReturnValueOnce(makeSelectChain([{ ...ACTIVE_USER, deactivatedAt: new Date() }]));

    const res = await request(buildApp())
      .post("/auth/refresh")
      .set("Cookie", "refresh_token=valid_token");

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/desativada|desativad/i);
  });
});
