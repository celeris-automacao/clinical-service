import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  usersTable: {},
  doctorsTable: {},
  patientsTable: {},
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
  sendTempPasswordEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_pw"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  signAccessToken: vi.fn().mockResolvedValue("new_access_token"),
  signClinicScopedToken: vi.fn().mockResolvedValue("clinic_scoped_token"),
}));

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import authRouter from "../auth";

function buildApp() {
  const app = express();
  app.use(express.json());
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
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.then = (onFulfilled: any, onRejected: any) => Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
}

function makeInsertChain(returnValue: unknown[] = []): any {
  const chain: any = {};
  chain.values = vi.fn((values) => {
    chain._values = values;
    return chain;
  });
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  chain.then = (onFulfilled: any, onRejected: any) => Promise.resolve(returnValue).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(returnValue).catch(handler);
  return chain;
}

function makeUpdateChain(returnValue: unknown[] = []): any {
  const chain: any = {};
  chain.set = vi.fn((values) => {
    chain._values = values;
    return chain;
  });
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

describe("POST /auth/register cpf normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores normalized CPF on the user record", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain([
      { id: 1, email: "owner@clinic.dev", name: "Owner", role: "clinic_owner", isTemporaryPassword: false },
    ]));

    const res = await request(buildApp())
      .post("/auth/register")
      .send({
        email: "owner@clinic.dev",
        password: "Test1234!",
        name: "Owner",
        role: "clinic_owner",
        cpf: "111.444.777-35",
        avatarUrl: "/objects/owner-photo.webp",
      });

    expect(res.status).toBe(201);
    const insertChain = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(insertChain._values.cpf).toBe("11144477735");
    expect(insertChain._values.avatarUrl).toBe("/objects/owner-photo.webp");
  });
});

describe("PATCH /users/me profile update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the owner's optional Brazilian profile fields", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: 5, role: "clinic_owner" },
    } as any);
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));
    const updatedUser = {
      id: 5,
      clerkId: null,
      email: "owner.updated@clinic.dev",
      name: "Owner Updated",
      role: "clinic_owner",
      avatarUrl: null,
      isTemporaryPassword: false,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      cpf: "11144477735",
      rg: "12.345.678-9",
      phone: "(11) 99999-9999",
      birthDate: "1990-04-15",
    };
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain([updatedUser]));

    const res = await request(buildApp())
      .patch("/users/me")
      .send({
        name: "Owner Updated",
        email: "OWNER.UPDATED@CLINIC.DEV",
        cpf: "111.444.777-35",
        rg: "12.345.678-9",
        phone: "(11) 99999-9999",
        birthDate: "1990-04-15",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: "owner.updated@clinic.dev",
      cpf: "11144477735",
      rg: "12.345.678-9",
      phone: "(11) 99999-9999",
      birthDate: "1990-04-15",
    });
    const updateChain = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(updateChain._values).toMatchObject({
      email: "owner.updated@clinic.dev",
      cpf: "11144477735",
      rg: "12.345.678-9",
      phone: "(11) 99999-9999",
      birthDate: "1990-04-15",
    });
  });

  it("rejects an invalid CPF without updating the profile", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: 5, role: "clinic_owner" },
    } as any);

    const res = await request(buildApp())
      .patch("/users/me")
      .send({ cpf: "123.456.789-00" });

    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does not allow other roles to edit owner identification fields", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: 5, role: "patient" },
    } as any);

    const res = await request(buildApp())
      .patch("/users/me")
      .send({ phone: "(11) 99999-9999" });

    expect(res.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });
});
