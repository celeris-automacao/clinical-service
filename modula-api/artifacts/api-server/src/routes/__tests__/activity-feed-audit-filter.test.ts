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
  patientsTable: {},
  doctorsTable: {},
  patientDoctorsTable: {},
  usersTable: {},
  checkInsTable: {},
  weightEntriesTable: {},
  xpEntriesTable: {},
  sabotageNotesTable: {},
  staffEventsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  clinicSettingsTable: {},
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(() => ({ userId: null })),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  resolveCallerClinicId: vi.fn().mockResolvedValue(1),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth, resolveCallerClinicId } from "../../lib/auth-helpers";
import clinicRouter from "../clinic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(clinicRouter);
  return app;
}

function makeSelectChain(data: unknown[]): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(data));
  chain.leftJoin = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  // Make the chain itself thenable so queries without .limit() can be awaited
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(data).then(resolve, reject);
  return chain;
}

const OWNER_AUTH = {
  user: { id: 10, role: "clinic_owner" as const },
  clinicId: 1,
};

const PATIENT_AUTH = {
  user: { id: 20, role: "patient" as const },
  clinicId: null,
};

function mockOwnerWithStaffEvents(events: unknown[]) {
  (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(OWNER_AUTH);
  (resolveCallerClinicId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);

  let selectCallCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    selectCallCount++;
    // call 1: resolveVisiblePatientIds (patientClinicsTable) — must return ≥1 row
    if (selectCallCount === 1) return makeSelectChain([{ patientId: 1 }]);
    // calls 2-4: Promise.all — checkIns, weights, sabotages
    if (selectCallCount === 2) return makeSelectChain([]);
    if (selectCallCount === 3) return makeSelectChain([]);
    if (selectCallCount === 4) return makeSelectChain([]);
    // call 5: staffEvents
    if (selectCallCount === 5) return makeSelectChain(events);
    return makeSelectChain([]);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /clinic/activity-feed — audit_write_failure exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller is a patient", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(PATIENT_AUTH);

    const app = buildApp();
    const res = await request(app).get("/clinic/activity-feed");

    expect(res.status).toBe(403);
  });

  it("does not include audit_write_failure events in the response for clinic_owner", async () => {
    const auditEvent = {
      se: {
        id: 99,
        type: "audit_write_failure",
        description: "Audit log write failed — compliance alert",
        createdAt: new Date("2025-01-01T12:00:00Z"),
      },
      user: { id: 10, name: "Carlos Admin", avatarUrl: null },
    };

    mockOwnerWithStaffEvents([auditEvent]);

    const app = buildApp();
    const res = await request(app).get("/clinic/activity-feed");

    expect(res.status).toBe(200);
    const types: string[] = (res.body as { type: string }[]).map((item) => item.type);
    expect(types).not.toContain("audit_write_failure");
    expect(types).not.toContain("staff_onboarding");
  });

  it("includes legitimate staff events and excludes audit_write_failure when both are present", async () => {
    const legitimateEvent = {
      se: {
        id: 1,
        type: "appointment_booked",
        description: "Appointment booked",
        createdAt: new Date("2025-01-01T11:00:00Z"),
      },
      user: { id: 10, name: "Carlos Admin", avatarUrl: null },
    };
    const auditEvent = {
      se: {
        id: 99,
        type: "audit_write_failure",
        description: "Audit log write failed",
        createdAt: new Date("2025-01-01T12:00:00Z"),
      },
      user: { id: 10, name: "Carlos Admin", avatarUrl: null },
    };

    mockOwnerWithStaffEvents([legitimateEvent, auditEvent]);

    const app = buildApp();
    const res = await request(app).get("/clinic/activity-feed");

    expect(res.status).toBe(200);
    const types: string[] = (res.body as { type: string }[]).map((item) => item.type);
    expect(types).toContain("appointment_booked");
    expect(types).not.toContain("audit_write_failure");
    expect(types).not.toContain("staff_onboarding");
  });
});
