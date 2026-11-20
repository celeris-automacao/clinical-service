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
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  resolveOwnerClinicId: vi.fn(),
  authenticateRequest: vi.fn(),
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

import { authenticateRequest } from "../../lib/auth-helpers";
import { db } from "@workspace/db";
import authRouter from "../auth";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    _req.log = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };
    next();
  });
  app.use(authRouter);
  return app;
}

describe("POST /auth/complete-profile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
  });

  it("returns 503 when Clerk is not configured", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/auth/complete-profile")
      .send({ name: "Ana", role: "patient" });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("integration_not_configured");
  });

  it("returns 401 when configured Clerk is unavailable", async () => {
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_example";
    process.env.CLERK_SECRET_KEY = "sk_test_example";
    (authenticateRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      authenticated: false,
      reason: "clerk_unavailable",
    });

    const app = buildApp();
    const res = await request(app)
      .post("/auth/complete-profile")
      .send({ name: "Ana", role: "patient" });

    expect(res.status).toBe(401);
  });

  it("uses authenticated Clerk identity when available", async () => {
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_example";
    process.env.CLERK_SECRET_KEY = "sk_test_example";
    (authenticateRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      authenticated: true,
      strategy: "clerk",
      user: {
        id: 10,
        clerkId: "clerk_123",
        email: "ana@example.com",
        name: "Ana",
        role: "patient",
        deactivatedAt: null,
        createdAt: new Date(),
      },
    });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: 10,
            clerkId: "clerk_123",
            email: "ana@example.com",
            name: "Ana",
            role: "patient",
            avatarUrl: null,
            createdAt: new Date(),
          },
        ]),
      }),
    });

    const app = buildApp();
    const res = await request(app)
      .post("/auth/complete-profile")
      .send({ name: "Ana", role: "patient" });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("ana@example.com");
  });
});
