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
  auditFailuresTable: {},
  auditAlertCooldownTable: {},
  staffEventsTable: {},
  waterEntriesTable: {},
  exerciseEntriesTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  clinicsTable: {},
  patientDoctorsTable: {},
  doctorsTable: {},
  doctorInsurancesTable: {},
  xpEntriesTable: {},
  clinicSettingsTable: {},
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(() => ({ userId: null })),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  resolveOwnerClinicId: vi.fn(),
  ensurePatientAccess: vi.fn(),
  ensureClinicAccess: vi.fn(),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
  resolveCallerClinicId: vi.fn().mockResolvedValue(1),
}));

vi.mock("../../lib/email", () => ({
  sendDeletionRequestNotificationEmail: vi.fn().mockResolvedValue(undefined),
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
  sendInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendAuditFailureAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth, resolveOwnerClinicId, ensurePatientAccess, resolveCallerClinicId } from "../../lib/auth-helpers";
import { sendAuditFailureAlertEmail } from "../../lib/email";
import lgpdRouter from "../lgpd";
import patientsRouter from "../patients";

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

function buildPatientsApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(patientsRouter);
  return app;
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

/**
 * A chainable select mock that:
 * - supports .from() → .innerJoin() / .leftJoin() → .where() → .orderBy() → .limit()
 * - also resolves when awaited directly (thenable), covering queries that end in .where()
 */
function makeSelectChain(data: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
}

/**
 * A select chain that actually evaluates Drizzle's isNull predicate against the
 * provided rows so tests can seed a MIXED dataset (resolved + unresolved) and
 * assert genuine filtering behaviour rather than pre-filtering the mock data.
 *
 * - For "count" mode: serialises the WHERE condition and, when "is null" is
 *   detected, returns a count row reflecting only failure rows whose
 *   `failure.resolvedAt` is null.
 * - For "items" mode: same detection, but filters the full row objects and
 *   returns only those with `failure.resolvedAt === null`.
 *
 * The filter detection (`JSON.stringify(condition).includes("is null")`) works
 * because Drizzle SQL objects serialise their queryChunks array — the " is null"
 * string literal from `isNull()` appears verbatim in the JSON output.
 */
type FilteringMode = "count" | "items";

function makeFilteringSelectChain(
  allRows: Array<{ failure: { resolvedAt: Date | null } }>,
  mode: FilteringMode = "items",
): any {
  const chain: any = {};
  let resolvedData: unknown = mode === "count"
    ? [{ count: String(allRows.length) }]
    : allRows;

  chain.from = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);

  chain.where = vi.fn((condition: unknown) => {
    const condStr = JSON.stringify(condition);
    if (condStr.includes("is null")) {
      const filtered = allRows.filter((r) => r.failure.resolvedAt === null);
      resolvedData = mode === "count"
        ? [{ count: String(filtered.length) }]
        : filtered;
    }
    return chain;
  });

  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(resolvedData));
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolvedData).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(resolvedData).catch(handler);
  return chain;
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const OWNER_AUTH = {
  user: {
    id: 21,
    email: "owner@clinica.dev",
    name: "Dono Tester",
    role: "clinic_owner" as const,
    clerkId: null,
    passwordHash: null,
    isTemporaryPassword: false,
    avatarUrl: null,
    deactivatedAt: null,
    appleUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  clinicId: 1,
};

const DOCTOR_AUTH = {
  user: {
    ...OWNER_AUTH.user,
    id: 20,
    email: "doctor@clinica.dev",
    name: "Dr. Tester",
    role: "profissional_saude" as const,
  },
  clinicId: 1,
};

const ACCESSED_AT = new Date("2026-07-08T10:00:00.000Z");

const LOG_ROW = {
  log: {
    id: 99,
    accessorUserId: 20,
    accessorRole: "profissional_saude",
    patientId: 5,
    clinicId: 1,
    fieldsAccessed: ["cpf", "phone"],
    accessedAt: ACCESSED_AT,
  },
  accessorUser: { id: 20, name: "Dr. Tester", email: "doctor@clinica.dev" },
  patientUser: { id: 5 },
};

const PATIENT_NAME_ROW = {
  patientId: 5,
  userId: 30,
  name: "Paciente Tester",
};

// ── GET /clinics/me/access-logs — read side ───────────────────────────────────

describe("GET /clinics/me/access-logs — read side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller is not a clinic_owner", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/administradores/i);
  });

  it("returns 403 when the owner is not linked to any clinic", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/clínica/i);
  });

  it("returns the audit log row written by a doctor lookup with correct shape", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    // First select: main log query (ends with .limit())
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([LOG_ROW]))
      // Second select: patient name lookup (awaited directly via thenable)
      .mockReturnValueOnce(makeSelectChain([PATIENT_NAME_ROW]));

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);

    const entry = res.body[0];
    expect(entry.id).toBe(99);
    expect(entry.accessorUserId).toBe(20);
    expect(entry.accessorName).toBe("Dr. Tester");
    expect(entry.accessorRole).toBe("profissional_saude");
    expect(entry.patientId).toBe(5);
    expect(entry.patientName).toBe("Paciente Tester");
    expect(entry.clinicId).toBe(1);
    expect(entry.fieldsAccessed).toEqual(["cpf", "phone"]);
    expect(entry.accessedAt).toBe(ACCESSED_AT.toISOString());
  });

  it("returns an empty array when no access logs exist for the clinic", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    // First select: no rows; second select skipped (patientIds is empty)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns a row with empty fieldsAccessed when the doctor accessed a patient with no sensitive data", async () => {
    // Even if no sensitive fields were populated, the row still appears
    // (LGPD Art. 37 — owner must see that the access occurred)
    const logWithNoSensitiveFields = {
      ...LOG_ROW,
      log: { ...LOG_ROW.log, fieldsAccessed: [] },
    };

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([logWithNoSensitiveFields]))
      .mockReturnValueOnce(makeSelectChain([PATIENT_NAME_ROW]));

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].fieldsAccessed).toEqual([]);
    expect(res.body[0].accessorRole).toBe("profissional_saude");
  });

  it("falls back to '—' when the patient name cannot be resolved", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([LOG_ROW]))
      // Patient name lookup returns nothing for this patientId
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(200);
    expect(res.body[0].patientName).toBe("—");
  });

  it("passes the resolved clinicId to resolveOwnerClinicId using the auth user and embedded clinicId", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))

    await request(buildApp()).get("/clinics/me/access-logs");

    expect(resolveOwnerClinicId).toHaveBeenCalledWith(OWNER_AUTH.user.id, OWNER_AUTH.clinicId);
  });

  it("returns multiple log rows in descending accessedAt order as returned by the DB", async () => {
    const earlier = new Date("2026-07-07T09:00:00.000Z");
    const later = new Date("2026-07-08T10:00:00.000Z");

    const row1 = {
      log: { ...LOG_ROW.log, id: 100, accessedAt: later },
      accessorUser: LOG_ROW.accessorUser,
      patientUser: LOG_ROW.patientUser,
    };
    const row2 = {
      log: { ...LOG_ROW.log, id: 101, accessedAt: earlier },
      accessorUser: LOG_ROW.accessorUser,
      patientUser: LOG_ROW.patientUser,
    };

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([row1, row2]))
      .mockReturnValueOnce(makeSelectChain([PATIENT_NAME_ROW]));

    const res = await request(buildApp()).get("/clinics/me/access-logs");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(100);
    expect(res.body[0].accessedAt).toBe(later.toISOString());
    expect(res.body[1].id).toBe(101);
    expect(res.body[1].accessedAt).toBe(earlier.toISOString());
  });
});

// ── GET /clinics/me/audit-failures — ownerNotifiedAt field ───────────────────

const FAILED_AT = new Date("2026-07-01T08:00:00.000Z");
const NOTIFIED_AT = new Date("2026-07-02T09:30:00.000Z");

function makeAuditFailureRow(overrides: Partial<{
  id: number;
  ownerNotifiedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: number | null;
}>): { failure: any; accessorName: string | null } {
  return {
    failure: {
      id: overrides.id ?? 1,
      clinicId: 1,
      accessorUserId: 20,
      accessorRole: "profissional_saude",
      patientId: 5,
      fieldsAccessed: ["cpf"],
      errorMessage: "DB write failed",
      failedAt: FAILED_AT,
      resolvedAt: overrides.resolvedAt ?? null,
      resolvedBy: overrides.resolvedBy ?? null,
      ownerNotifiedAt: overrides.ownerNotifiedAt !== undefined
        ? overrides.ownerNotifiedAt
        : null,
    },
    accessorName: "Dr. Tester",
  };
}

describe("GET /clinics/me/audit-failures — ownerNotifiedAt field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller is not a clinic_owner", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/administradores/i);
  });

  it("returns 403 when the owner is not linked to any clinic", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/clínica/i);
  });

  it("returns ownerNotifiedAt as null when the owner has not yet been notified", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    const row = makeAuditFailureRow({ id: 10, ownerNotifiedAt: null });

    // First select: count query (thenable)
    // Second select: items query (ends with .limit())
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ count: "1" }]))
      .mockReturnValueOnce(makeSelectChain([row]));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.recent).toHaveLength(1);

    const entry = res.body.recent[0];
    expect(entry.id).toBe(10);
    expect(entry.ownerNotifiedAt).toBeNull();
  });

  it("returns ownerNotifiedAt as an ISO timestamp string when the owner was already notified", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    const row = makeAuditFailureRow({ id: 11, ownerNotifiedAt: NOTIFIED_AT });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ count: "1" }]))
      .mockReturnValueOnce(makeSelectChain([row]));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    expect(res.body.recent).toHaveLength(1);

    const entry = res.body.recent[0];
    expect(entry.id).toBe(11);
    expect(entry.ownerNotifiedAt).toBe(NOTIFIED_AT.toISOString());
  });

  it("includes ownerNotifiedAt for every row in a multi-row response", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    const notNotified = makeAuditFailureRow({ id: 20, ownerNotifiedAt: null });
    const alreadyNotified = makeAuditFailureRow({ id: 21, ownerNotifiedAt: NOTIFIED_AT });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ count: "2" }]))
      .mockReturnValueOnce(makeSelectChain([notNotified, alreadyNotified]));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.recent).toHaveLength(2);

    const [first, second] = res.body.recent;
    expect(first.id).toBe(20);
    expect(first.ownerNotifiedAt).toBeNull();
    expect(second.id).toBe(21);
    expect(second.ownerNotifiedAt).toBe(NOTIFIED_AT.toISOString());
  });

  it("returns an empty recent array with count 0 when there are no unresolved failures", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ count: "0" }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.recent).toEqual([]);
  });

  it("serializes the full failure shape correctly alongside ownerNotifiedAt", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    const row = makeAuditFailureRow({ id: 30, ownerNotifiedAt: NOTIFIED_AT });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([{ count: "1" }]))
      .mockReturnValueOnce(makeSelectChain([row]));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    const entry = res.body.recent[0];

    expect(entry.id).toBe(30);
    expect(entry.clinicId).toBe(1);
    expect(entry.accessorUserId).toBe(20);
    expect(entry.accessorName).toBe("Dr. Tester");
    expect(entry.accessorRole).toBe("profissional_saude");
    expect(entry.patientId).toBe(5);
    expect(entry.fieldsAccessed).toEqual(["cpf"]);
    expect(entry.errorMessage).toBe("DB write failed");
    expect(entry.failedAt).toBe(FAILED_AT.toISOString());
    expect(entry.resolvedAt).toBeNull();
    expect(entry.resolvedBy).toBeNull();
    expect(entry.ownerNotifiedAt).toBe(NOTIFIED_AT.toISOString());
  });

  it("excludes the resolved failure from recent when both resolved and unresolved rows are in the dataset", async () => {
    // Seeds a MIXED dataset: one resolved row (id=41) and one unresolved row (id=40).
    // makeFilteringSelectChain evaluates the handler's isNull(resolvedAt) WHERE
    // predicate and filters accordingly — so the response must contain only the
    // unresolved row. If the handler's isNull condition were removed, the chain
    // would return both rows and the length assertion below would fail.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    const RESOLVED_AT = new Date("2026-07-05T12:00:00.000Z");
    const unresolvedRow = makeAuditFailureRow({ id: 40, resolvedAt: null });
    const resolvedRow = makeAuditFailureRow({ id: 41, resolvedAt: RESOLVED_AT, resolvedBy: 99 });
    const mixedRows = [unresolvedRow, resolvedRow];

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeFilteringSelectChain(mixedRows, "count"))
      .mockReturnValueOnce(makeFilteringSelectChain(mixedRows, "items"));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    // Only the unresolved row appears in recent
    expect(res.body.recent).toHaveLength(1);
    expect(res.body.recent[0].id).toBe(40);
    expect(res.body.recent[0].resolvedAt).toBeNull();
    // The resolved row must not appear
    const ids = (res.body.recent as any[]).map((r: any) => r.id);
    expect(ids).not.toContain(41);
  });

  it("count reflects only unresolved rows when both resolved and unresolved rows exist in the dataset", async () => {
    // Same mixed dataset (2 rows total): the isNull filter means the DB reports
    // count=1 and returns only the unresolved row. Response count must be 1, not 2.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

    const RESOLVED_AT = new Date("2026-07-06T14:00:00.000Z");
    const unresolvedRow = makeAuditFailureRow({ id: 50, resolvedAt: null });
    const resolvedRow = makeAuditFailureRow({ id: 51, resolvedAt: RESOLVED_AT, resolvedBy: 99 });
    const mixedRows = [unresolvedRow, resolvedRow];

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeFilteringSelectChain(mixedRows, "count"))
      .mockReturnValueOnce(makeFilteringSelectChain(mixedRows, "items"));

    const res = await request(buildApp()).get("/clinics/me/audit-failures");

    expect(res.status).toBe(200);
    // count must be 1 (unresolved only), not 2 (total with resolved)
    expect(res.body.count).toBe(1);
    expect(res.body.recent).toHaveLength(1);
    expect(res.body.recent[0].id).toBe(50);
    // count and recent.length must agree
    expect(res.body.count).toBe(res.body.recent.length);
  });
});

// ── Audit failure ownerNotifiedAt guard — notification dedup ─────────────────
//
// The notification path in patients.ts checks ownerNotifiedAt on the existing
// auditFailuresTable row before calling sendAuditFailureAlertEmail. When the
// field is already non-null the function must bail out without sending any
// email — preventing duplicates from background retries or server restarts.

const AUDIT_DEDUP_DOCTOR_AUTH = {
  user: {
    id: 20,
    email: "doctor@clinica.dev",
    name: "Dr. Tester",
    role: "profissional_saude" as const,
    clerkId: null,
    passwordHash: null,
    isTemporaryPassword: false,
    avatarUrl: null,
    deactivatedAt: null,
    appleUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  clinicId: 1,
};

const AUDIT_DEDUP_PATIENT_ROW = {
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
  psychologyNotes: null,
  physicalActivityNotes: null,
  endocrinologyNotes: null,
  height: null,
  dailyCalorieGoal: null,
  dailyWaterGoalMl: null,
  weeklyExerciseGoalDays: null,
  profileComplete: false,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: {
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
  },
};

describe("audit failure ownerNotifiedAt guard — notification dedup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does NOT call sendAuditFailureAlertEmail when ownerNotifiedAt is already set on the failure row", async () => {
    // Uses clinicId=520 (unique) to ensure the module-level L1 cooldown cache
    // for this clinicId is empty, so getLastAlertSentMs would proceed to the DB.
    //
    // Downstream mocks (cooldown, owner list, branding) are provided with
    // realistic data so that if the ownerNotifiedAt guard were accidentally
    // removed, the email path would fully succeed and sendAuditFailureAlertEmail
    // WOULD be called — making this assertion a true regression catch.
    vi.useFakeTimers();
    const app = buildPatientsApp();

    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(AUDIT_DEDUP_DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(AUDIT_DEDUP_PATIENT_ROW);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(520);

    const dbError = new Error("dataAccessLog write failed");

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError))    // dataAccessLog attempt 1
      .mockReturnValueOnce(makeRejectInsertChain(dbError))    // dataAccessLog attempt 2
      .mockReturnValueOnce(makeInsertChain([{ id: 77 }]))     // auditFailuresTable → id=77
      .mockReturnValueOnce(makeInsertChain())                  // staffEventsTable
      .mockReturnValue(makeInsertChain());                     // auditAlertCooldownTable (not reached when guard fires)

    const alreadyNotifiedAt = new Date();
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                                       // weightEntries (buildPatientResponse)
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))                           // xpEntries (buildPatientResponse)
      .mockReturnValueOnce(makeSelectChain([]))                                       // patientDoctors (buildPatientResponse)
      .mockReturnValueOnce(makeSelectChain([{ ownerNotifiedAt: alreadyNotifiedAt }])) // guard: already notified → bail out
      // Downstream mocks that would be consumed if the guard were absent:
      .mockReturnValueOnce(makeSelectChain([]))                                       // cooldown lookup (getLastAlertSentMs)
      .mockReturnValueOnce(makeSelectChain([{ email: "owner@clinica.dev", name: "Dono" }])) // owner list
      .mockReturnValue(makeSelectChain([{ clinicName: "Test Clinic" }]));             // branding (fetchClinicBranding)

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    // Guard fired after the 4th select and blocked the entire email path.
    // Exactly 4 selects means no cooldown/owner/branding lookups ran.
    expect(db.select).toHaveBeenCalledTimes(4);
    expect(sendAuditFailureAlertEmail).not.toHaveBeenCalled();
  });

  it("calls sendAuditFailureAlertEmail when ownerNotifiedAt is null (first-time dispatch)", async () => {
    // Positive control: confirms the guard does NOT block the email on the
    // normal first-time path where ownerNotifiedAt is null.
    // Uses clinicId=521 (unique) to avoid cooldown bleed from other tests.
    vi.useFakeTimers();
    const app = buildPatientsApp();

    vi.resetAllMocks();
    (sendAuditFailureAlertEmail as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(AUDIT_DEDUP_DOCTOR_AUTH);
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(AUDIT_DEDUP_PATIENT_ROW);
    (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(521);

    const dbError = new Error("dataAccessLog write failed");

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeRejectInsertChain(dbError))    // dataAccessLog attempt 1
      .mockReturnValueOnce(makeRejectInsertChain(dbError))    // dataAccessLog attempt 2
      .mockReturnValueOnce(makeInsertChain([{ id: 78 }]))     // auditFailuresTable → id=78
      .mockReturnValueOnce(makeInsertChain())                  // staffEventsTable
      .mockReturnValue(makeInsertChain());                     // auditAlertCooldownTable (markAlertSent)

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))                                  // weightEntries (buildPatientResponse)
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))                      // xpEntries (buildPatientResponse)
      .mockReturnValueOnce(makeSelectChain([]))                                  // patientDoctors (buildPatientResponse)
      .mockReturnValueOnce(makeSelectChain([{ ownerNotifiedAt: null }]))         // guard: null → proceed
      .mockReturnValueOnce(makeSelectChain([]))                                  // cooldown lookup (getLastAlertSentMs) → 0ms
      .mockReturnValueOnce(makeSelectChain([{ email: "owner@clinica.dev", name: "Dono" }])) // owner list
      .mockReturnValue(makeSelectChain([{ clinicName: "Test Clinic" }]));        // branding (fetchClinicBranding)

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    });

    const res = await request(app).get("/patients/5");
    await vi.advanceTimersByTimeAsync(600);

    expect(res.status).toBe(200);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendAuditFailureAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@clinica.dev", ownerName: "Dono" })
    );
  });
});
