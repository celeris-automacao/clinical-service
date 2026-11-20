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
  checkInsTable: {},
  weightEntriesTable: {},
  goalsTable: {},
  goalProgressTable: {},
  sabotageNotesTable: {},
  messagesTable: {},
  conversationsTable: {},
  consentRecordsTable: {},
  dataDeletionRequestsTable: {},
  dataAccessLogTable: {},
  staffEventsTable: {},
  waterEntriesTable: {},
  exerciseEntriesTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  clinicsTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  resolveOwnerClinicId: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendDeletionRequestNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(() => ({ userId: null })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import lgpdRouter from "../lgpd";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(lgpdRouter);
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

// ── Shared fixtures ───────────────────────────────────────────────────────────

const PATIENT_AUTH = {
  user: {
    id: 5,
    email: "patient@clinica.dev",
    name: "Paciente Teste",
    role: "patient" as const,
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

const STAFF_AUTH = {
  user: {
    ...PATIENT_AUTH.user,
    id: 6,
    email: "doctor@clinica.dev",
    role: "profissional_saude" as const,
  },
  clinicId: 1,
};

const ACTIVE_CONSENT = {
  id: 1,
  userId: 5,
  clinicId: null,
  purpose: "health_data_processing",
  version: "1.0",
  grantedAt: new Date("2026-01-01T00:00:00Z"),
  revokedAt: null,
  ipAddress: null,
};

// ── GET /patients/me/consent ──────────────────────────────────────────────────

describe("GET /patients/me/consent — consent gate status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns hasConsent: false when the patient has no active consent record", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/patients/me/consent");

    expect(res.status).toBe(200);
    expect(res.body.hasConsent).toBe(false);
    expect(res.body.grantedAt).toBeNull();
    expect(res.body.version).toBeNull();
  });

  it("returns hasConsent: true with consent details when an active record exists", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([ACTIVE_CONSENT])
    );

    const res = await request(buildApp()).get("/patients/me/consent");

    expect(res.status).toBe(200);
    expect(res.body.hasConsent).toBe(true);
    expect(res.body.grantedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(res.body.version).toBe("1.0");
    expect(res.body.purpose).toBe("health_data_processing");
  });

  it("returns 401 when the request is unauthenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: "Unauthorized",
      status: 401,
    });

    const res = await request(buildApp()).get("/patients/me/consent");

    expect(res.status).toBe(401);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-patient role (e.g. staff) checks consent", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(STAFF_AUTH);

    const res = await request(buildApp()).get("/patients/me/consent");

    expect(res.status).toBe(403);
    expect(db.select).not.toHaveBeenCalled();
  });
});

// ── POST /patients/me/consent ─────────────────────────────────────────────────

describe("POST /patients/me/consent — grant consent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates a consent record and returns 201 with the record details", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());
    const insertChain = makeInsertChain([ACTIVE_CONSENT]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(insertChain);

    const res = await request(buildApp())
      .post("/patients/me/consent")
      .send({ version: "1.0" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("purpose", "health_data_processing");
    expect(res.body).toHaveProperty("version", "1.0");
    expect(res.body).toHaveProperty("grantedAt");
  });

  it("revokes any prior active consent for the same purpose before inserting (idempotent re-consent)", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeInsertChain([ACTIVE_CONSENT])
    );

    await request(buildApp())
      .post("/patients/me/consent")
      .send({ version: "1.0" });

    expect(db.update).toHaveBeenCalledOnce();
    const setCall = updateChain.set.mock.calls[0][0];
    expect(setCall).toHaveProperty("revokedAt");
    expect(setCall.revokedAt).toBeInstanceOf(Date);
  });

  it("returns 403 when a non-patient tries to record consent", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(STAFF_AUTH);

    const res = await request(buildApp())
      .post("/patients/me/consent")
      .send({ version: "1.0" });

    expect(res.status).toBe(403);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: "Unauthorized",
      status: 401,
    });

    const res = await request(buildApp())
      .post("/patients/me/consent")
      .send({ version: "1.0" });

    expect(res.status).toBe(401);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

// ── DELETE /patients/me/consent ───────────────────────────────────────────────

describe("DELETE /patients/me/consent — revoke consent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets revokedAt on the active consent record and returns success", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(updateChain);

    const res = await request(buildApp()).delete("/patients/me/consent");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(db.update).toHaveBeenCalledOnce();
    const setArg = updateChain.set.mock.calls[0][0];
    expect(setArg).toHaveProperty("revokedAt");
    expect(setArg.revokedAt).toBeInstanceOf(Date);
  });

  it("returns 403 when a non-patient role attempts to revoke", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(STAFF_AUTH);

    const res = await request(buildApp()).delete("/patients/me/consent");

    expect(res.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: "Unauthorized",
      status: 401,
    });

    const res = await request(buildApp()).delete("/patients/me/consent");

    expect(res.status).toBe(401);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("accepts an optional clinicId body param without error", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());

    const res = await request(buildApp())
      .delete("/patients/me/consent")
      .send({ clinicId: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

// ── Revoke → re-login cycle ───────────────────────────────────────────────────

describe("revoke → re-login consent gate cycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET consent returns hasConsent: false after consent is revoked (POST → DELETE → GET)", async () => {
    const app = buildApp();

    // Step 1 — POST: patient grants consent
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeInsertChain([ACTIVE_CONSENT])
    );

    const grantRes = await request(app).post("/patients/me/consent").send({ version: "1.0" });
    expect(grantRes.status).toBe(201);
    expect(grantRes.body.purpose).toBe("health_data_processing");

    // Step 2 — DELETE: patient revokes consent
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());

    const revokeRes = await request(app).delete("/patients/me/consent");
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.success).toBe(true);

    // Step 3 — GET (simulates next login): consent check returns hasConsent: false
    // because no active (non-revoked) record exists anymore
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const checkRes = await request(app).get("/patients/me/consent");
    expect(checkRes.status).toBe(200);
    expect(checkRes.body.hasConsent).toBe(false);
    expect(checkRes.body.grantedAt).toBeNull();
  });

  it("GET consent returns hasConsent: true after patient re-grants following a revoke", async () => {
    const app = buildApp();

    // Step 1 — DELETE: revoke (start from revoked state)
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());

    const revokeRes = await request(app).delete("/patients/me/consent");
    expect(revokeRes.status).toBe(200);

    // Step 2 — GET: confirm hasConsent: false
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const checkBefore = await request(app).get("/patients/me/consent");
    expect(checkBefore.body.hasConsent).toBe(false);

    // Step 3 — POST: re-grant consent
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeInsertChain([ACTIVE_CONSENT])
    );

    const regrantRes = await request(app).post("/patients/me/consent").send({ version: "1.0" });
    expect(regrantRes.status).toBe(201);

    // Step 4 — GET: confirm hasConsent: true
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([ACTIVE_CONSENT])
    );

    const checkAfter = await request(app).get("/patients/me/consent");
    expect(checkAfter.body.hasConsent).toBe(true);
    expect(checkAfter.body.grantedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});
