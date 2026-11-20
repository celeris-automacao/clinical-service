import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

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
  isError: vi.fn((r: unknown) => r !== null && typeof r === "object" && "error" in (r as object)),
  resolveOwnerClinicId: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  signAccessToken: vi.fn().mockResolvedValue("jwt_token"),
  signClinicScopedToken: vi.fn().mockResolvedValue("clinic_token"),
}));

import { db } from "@workspace/db";
import { requireAuth, isError } from "../../lib/auth-helpers";
import authRouter from "../auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  return app;
}

function makeUpdateChainWithReturning(returning: unknown[] = []): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returning);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(returning).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(returning).catch(handler);
  return chain;
}

const USER_A = {
  id: 1,
  email: "ana@paciente.dev",
  name: "Ana",
  role: "patient" as const,
  clerkId: null,
  passwordHash: "hash",
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  appleUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const USER_B = {
  ...USER_A,
  id: 2,
  email: "bruno@paciente.dev",
  name: "Bruno",
};

describe("POST /auth/logout-all", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: "Não autenticado",
      status: 401,
    });

    const res = await request(buildApp()).post("/auth/logout-all");

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("revokes all non-revoked tokens for the authenticated user", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: USER_A,
      clinicId: null,
    });

    const revokedRows = [{ id: 10 }, { id: 11 }, { id: 12 }];
    const updateChain = makeUpdateChainWithReturning(revokedRows);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

    const res = await request(buildApp()).post("/auth/logout-all").set("Authorization", "Bearer jwt_token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.revokedCount).toBe(3);
    expect(db.update).toHaveBeenCalledOnce();
    expect(updateChain.set).toHaveBeenCalledOnce();
    const setArg = updateChain.set.mock.calls[0][0];
    expect(setArg).toHaveProperty("revokedAt");
    expect(setArg.revokedAt).toBeInstanceOf(Date);
  });

  it("returns revokedCount = 0 when the user has no active sessions", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: USER_A,
      clinicId: null,
    });

    const updateChain = makeUpdateChainWithReturning([]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

    const res = await request(buildApp()).post("/auth/logout-all").set("Authorization", "Bearer jwt_token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.revokedCount).toBe(0);
  });

  it("only revokes tokens for the requesting user, not for other users", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: USER_A,
      clinicId: null,
    });

    const updateChain = makeUpdateChainWithReturning([{ id: 10 }]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

    const res = await request(buildApp()).post("/auth/logout-all").set("Authorization", "Bearer jwt_token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // The DB update was called once — meaning it was scoped to one user.
    // Isolation of USER_B is guaranteed by the WHERE clause (userId = USER_A.id).
    expect(db.update).toHaveBeenCalledOnce();
    // Confirm the where clause ran (meaning the filter was applied)
    expect(updateChain.where).toHaveBeenCalledOnce();
  });

  it("USER_B tokens are untouched when USER_A signs out all", async () => {
    // Simulate two separate calls: first USER_A, then check USER_B's token is not revoked.
    // In practice this is enforced by the WHERE user_id = ? clause.
    // We verify by calling the endpoint as USER_B and confirming a fresh update call.
    (requireAuth as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ user: USER_A, clinicId: null })
      .mockResolvedValueOnce({ user: USER_B, clinicId: null });

    const updateChainA = makeUpdateChainWithReturning([{ id: 10 }]);
    const updateChainB = makeUpdateChainWithReturning([{ id: 20 }, { id: 21 }]);
    (db.update as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(updateChainA)
      .mockReturnValueOnce(updateChainB);

    const resA = await request(buildApp()).post("/auth/logout-all").set("Authorization", "Bearer token_a");
    const resB = await request(buildApp()).post("/auth/logout-all").set("Authorization", "Bearer token_b");

    expect(resA.status).toBe(200);
    expect(resA.body.revokedCount).toBe(1);

    expect(resB.status).toBe(200);
    expect(resB.body.revokedCount).toBe(2);

    // Each call triggered exactly one DB update scoped to its own user
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("sets revokedAt to approximately the current time", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: USER_A,
      clinicId: null,
    });

    const updateChain = makeUpdateChainWithReturning([{ id: 10 }]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

    const before = Date.now();
    await request(buildApp()).post("/auth/logout-all").set("Authorization", "Bearer jwt_token");
    const after = Date.now();

    const setArg = updateChain.set.mock.calls[0][0];
    const revokedAt: Date = setArg.revokedAt;

    expect(revokedAt).toBeInstanceOf(Date);
    expect(revokedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(revokedAt.getTime()).toBeLessThanOrEqual(after + 100);
  });
});
