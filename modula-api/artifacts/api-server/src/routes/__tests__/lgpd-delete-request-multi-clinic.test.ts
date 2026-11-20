import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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

// ── Import after mocks are registered ────────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import { sendDeletionRequestNotificationEmail } from "../../lib/email";
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

/**
 * Chainable drizzle select mock. Every builder method returns the same chain.
 * `.limit()` resolves to `data`; the chain itself is thenable so
 * `await chain.where(...)` also resolves to `data`.
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

function makeInsertChain(returningData: unknown[] = []): any {
  const chain: any = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returningData);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(returningData).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(returningData).catch(handler);
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PATIENT_USER = {
  id: 42,
  role: "patient" as const,
  email: "paciente@multi.com",
  name: "Ana Multi",
  clerkId: null,
  passwordHash: "hashed",
  isTemporaryPassword: false,
  avatarUrl: null,
  accessToken: null,
  deactivatedAt: null,
  deletionRequestedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DELETION_REQUEST_ROW = {
  id: 1,
  userId: PATIENT_USER.id,
  requestedAt: new Date("2026-07-07T10:00:00Z"),
  approvedAt: null,
  cancelledAt: null,
  approvedBy: null,
  notes: null,
};

const PATIENT_ROW = { id: 7 };

const ENROLLMENTS = [{ clinicId: 10 }, { clinicId: 20 }];

const OWNER_ROWS = [
  {
    ownerName: "Carlos Owner",
    ownerEmail: "carlos@clinic-a.com",
    clinicName: "Clínica A",
    clinicId: 10,
  },
  {
    ownerName: "Maria Owner",
    ownerEmail: "maria@clinic-b.com",
    clinicName: "Clínica B",
    clinicId: 20,
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /patients/me/delete-request — multi-clinic email notification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: PATIENT_USER,
      clinicId: null,
    });
  });

  it("sends one email per owner when the patient belongs to 2 different clinics with different owners", async () => {
    // Select call order inside the handler:
    //  1. Check for existing pending deletion request (→ none found)
    //  2. Check for recently cancelled request / 24h cooldown (→ none found)
    //  3. Look up patient row by userId (→ found)
    //  4. Look up patientClinics enrollments (→ 2 clinics)
    //  5. Look up clinic owners across both clinicIds (→ 2 owners, one per clinic)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))            // no existing pending request
      .mockReturnValueOnce(makeSelectChain([]))            // no recently cancelled request
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW])) // patient lookup
      .mockReturnValueOnce(makeSelectChain(ENROLLMENTS))   // enrollments
      .mockReturnValueOnce(makeSelectChain(OWNER_ROWS));   // owner query

    // Insert call order:
    //  1. dataDeletionRequestsTable (returns the new request row)
    //  2. staffEventsTable for clinicId 10
    //  3. staffEventsTable for clinicId 20
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain())
      .mockReturnValueOnce(makeInsertChain());

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(DELETION_REQUEST_ROW.id);

    expect(sendDeletionRequestNotificationEmail).toHaveBeenCalledTimes(2);

    const calls = (sendDeletionRequestNotificationEmail as ReturnType<typeof vi.fn>).mock.calls;

    // First email goes to the owner of Clínica A
    expect(calls[0][0]).toMatchObject({
      to: "carlos@clinic-a.com",
      ownerName: "Carlos Owner",
      patientName: "Ana Multi",
      clinicName: "Clínica A",
    });

    // Second email goes to the owner of Clínica B
    expect(calls[1][0]).toMatchObject({
      to: "maria@clinic-b.com",
      ownerName: "Maria Owner",
      patientName: "Ana Multi",
      clinicName: "Clínica B",
    });

    // Both calls must carry a Date for requestedAt
    expect(calls[0][0].requestedAt).toBeInstanceOf(Date);
    expect(calls[1][0].requestedAt).toBeInstanceOf(Date);
  });

  it("sends one email when the patient belongs to only 1 clinic", async () => {
    const singleEnrollment = [{ clinicId: 10 }];
    const singleOwner = [OWNER_ROWS[0]];

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))              // no existing pending request
      .mockReturnValueOnce(makeSelectChain([]))              // no recently cancelled request
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))   // patient lookup
      .mockReturnValueOnce(makeSelectChain(singleEnrollment)) // enrollments
      .mockReturnValueOnce(makeSelectChain(singleOwner));    // owner query

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain());

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(201);
    expect(sendDeletionRequestNotificationEmail).toHaveBeenCalledTimes(1);
    expect((sendDeletionRequestNotificationEmail as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      to: "carlos@clinic-a.com",
      clinicName: "Clínica A",
    });
  });

  it("sends no email when the patient has no clinic enrollments", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))            // no existing pending request
      .mockReturnValueOnce(makeSelectChain([]))            // no recently cancelled request
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW])) // patient found
      .mockReturnValueOnce(makeSelectChain([]));           // no enrollments → skips owner query entirely

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]));

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(201);
    expect(sendDeletionRequestNotificationEmail).not.toHaveBeenCalled();
  });

  it("returns 201 and emits a warning log when the clinic has no owners configured", async () => {
    const warnMock = vi.fn();

    // Select call order inside the handler:
    //  1. Check for existing pending deletion request  (→ none)
    //  2. Check for recently cancelled request / 24-h cooldown  (→ none)
    //  3. Look up patient row by userId  (→ found)
    //  4. Look up patientClinics enrollments  (→ clinic 10)
    //  5. Look up clinic owners for clinic 10  (→ empty — the mis-configured case)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))            // no existing request
      .mockReturnValueOnce(makeSelectChain([]))            // no recently cancelled
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW])) // patient lookup
      .mockReturnValueOnce(makeSelectChain([{ clinicId: 10 }])) // enrolled in clinic 10
      .mockReturnValueOnce(makeSelectChain([]));           // no owners found for clinic 10

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain()); // staffEvent for clinic 10

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    // Override the app to capture req.log.warn
    const app = express();
    app.use(express.json());
    app.use((_req: any, _res: any, next: any) => {
      (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: warnMock };
      next();
    });
    app.use(lgpdRouter);

    const res = await request(app)
      .post("/patients/me/delete-request")
      .send({});

    // Request must still be saved and return 201
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(DELETION_REQUEST_ROW.id);

    // No emails should be sent
    expect(sendDeletionRequestNotificationEmail).not.toHaveBeenCalled();

    // A warning must be logged so operators can detect mis-configured clinics
    expect(warnMock).toHaveBeenCalledOnce();
    const [context, message] = warnMock.mock.calls[0];
    expect(context).toMatchObject({ unnotifiedClinicIds: [10], userId: PATIENT_USER.id });
    expect(message).toMatch(/no clinic owners found/i);
  });

  it("sends email to the clinic that has owners and warns about the clinic that does not", async () => {
    const warnMock = vi.fn();

    // Patient enrolled in clinics 10 and 20; clinic 10 has an owner, clinic 20 does not
    const mixedOwnerRows = [
      {
        ownerName: "Carlos Owner",
        ownerEmail: "carlos@clinic-a.com",
        clinicName: "Clínica A",
        clinicId: 10,
      },
    ];

    // Select call order:
    //  1. Existing pending deletion request  (→ none)
    //  2. Recently cancelled / 24-h cooldown (→ none)
    //  3. Patient lookup                     (→ found)
    //  4. Enrollments                        (→ clinics 10 and 20)
    //  5. Owner query for [10, 20]           (→ only clinic 10 has an owner)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))             // no existing request
      .mockReturnValueOnce(makeSelectChain([]))             // no recently cancelled
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))  // patient lookup
      .mockReturnValueOnce(makeSelectChain(ENROLLMENTS))    // enrollments (clinics 10 & 20)
      .mockReturnValueOnce(makeSelectChain(mixedOwnerRows)); // only clinic 10 has owner

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain()) // staffEvent clinic 10
      .mockReturnValueOnce(makeInsertChain()); // staffEvent clinic 20

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const app = express();
    app.use(express.json());
    app.use((_req: any, _res: any, next: any) => {
      (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: warnMock };
      next();
    });
    app.use(lgpdRouter);

    const res = await request(app)
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(201);

    // Only the clinic that has an owner should be emailed
    expect(sendDeletionRequestNotificationEmail).toHaveBeenCalledTimes(1);
    expect((sendDeletionRequestNotificationEmail as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      to: "carlos@clinic-a.com",
      clinicName: "Clínica A",
    });

    // Clinic 20 (no owners) must surface a warning with the unnotified clinic ID
    expect(warnMock).toHaveBeenCalledOnce();
    const [context, message] = warnMock.mock.calls[0];
    expect(context).toMatchObject({ unnotifiedClinicIds: [20], userId: PATIENT_USER.id });
    expect(message).toMatch(/no clinic owners found/i);
  });

  it("sends one email per co-owner when 1 clinic has 2 different owners", async () => {
    // Scenario: patient is enrolled in exactly 1 clinic, but that clinic has
    // two distinct co-owners with different email addresses. The deduplication
    // logic must NOT collapse them — both owners should receive their own email.
    const singleEnrollment = [{ clinicId: 10 }];
    const coOwnerRows = [
      {
        ownerName: "Alice Owner",
        ownerEmail: "alice@clinic-a.com",
        clinicName: "Clínica A",
        clinicId: 10,
      },
      {
        ownerName: "Bob Owner",
        ownerEmail: "bob@clinic-a.com",
        clinicName: "Clínica A",
        clinicId: 10,
      },
    ];

    // Select call order:
    //  1. Check for existing pending deletion request  (→ none)
    //  2. Check for recently cancelled / 24-h cooldown (→ none)
    //  3. Look up patient row by userId               (→ found)
    //  4. Look up patientClinics enrollments          (→ 1 clinic)
    //  5. Look up clinic owners for [10]              (→ 2 different owners)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))               // no existing pending request
      .mockReturnValueOnce(makeSelectChain([]))               // no recently cancelled request
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))    // patient lookup
      .mockReturnValueOnce(makeSelectChain(singleEnrollment)) // 1 enrollment
      .mockReturnValueOnce(makeSelectChain(coOwnerRows));     // 2 co-owners on same clinic

    // Insert call order:
    //  1. dataDeletionRequestsTable
    //  2. staffEventsTable for clinicId 10 (one event per enrolled clinic, not per owner)
    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain());

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(DELETION_REQUEST_ROW.id);

    // Two distinct owners → two emails, one each
    expect(sendDeletionRequestNotificationEmail).toHaveBeenCalledTimes(2);

    const calls = (sendDeletionRequestNotificationEmail as ReturnType<typeof vi.fn>).mock.calls;

    expect(calls[0][0]).toMatchObject({
      to: "alice@clinic-a.com",
      ownerName: "Alice Owner",
      patientName: "Ana Multi",
      clinicName: "Clínica A",
    });

    expect(calls[1][0]).toMatchObject({
      to: "bob@clinic-a.com",
      ownerName: "Bob Owner",
      patientName: "Ana Multi",
      clinicName: "Clínica A",
    });

    // Both calls must carry a Date for requestedAt
    expect(calls[0][0].requestedAt).toBeInstanceOf(Date);
    expect(calls[1][0].requestedAt).toBeInstanceOf(Date);
  });

  it("returns 409 when a pending deletion request already exists and sends no email", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([DELETION_REQUEST_ROW]));

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(409);
    expect(sendDeletionRequestNotificationEmail).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is not a patient", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { ...PATIENT_USER, role: "clinic_owner" as const },
    });

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(403);
    expect(sendDeletionRequestNotificationEmail).not.toHaveBeenCalled();
  });

  it("sends only one email when the same owner owns both clinics the patient belongs to", async () => {
    // Scenario: patient enrolled in clinic 10 and clinic 20, but both are owned
    // by the same person. The owner query returns 2 rows (one per clinicOwnersTable
    // row) with the same ownerEmail. The handler must deduplicate and send exactly 1 email.
    const SAME_OWNER_ROWS = [
      {
        ownerName: "Carlos Owner",
        ownerEmail: "carlos@both-clinics.com",
        clinicName: "Clínica A",
        clinicId: 10,
      },
      {
        ownerName: "Carlos Owner",
        ownerEmail: "carlos@both-clinics.com",
        clinicName: "Clínica B",
        clinicId: 20,
      },
    ];

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))              // no existing pending request
      .mockReturnValueOnce(makeSelectChain([]))              // no recently cancelled request
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))   // patient lookup
      .mockReturnValueOnce(makeSelectChain(ENROLLMENTS))     // enrollments (2 clinics)
      .mockReturnValueOnce(makeSelectChain(SAME_OWNER_ROWS)); // owner query → same person twice

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain())  // staffEvent clinic 10
      .mockReturnValueOnce(makeInsertChain()); // staffEvent clinic 20

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    expect(res.status).toBe(201);

    // Despite 2 ownership rows returned by the DB, only 1 email must be sent
    expect(sendDeletionRequestNotificationEmail).toHaveBeenCalledTimes(1);

    const [call] = (sendDeletionRequestNotificationEmail as ReturnType<typeof vi.fn>).mock.calls;
    expect(call[0]).toMatchObject({
      to: "carlos@both-clinics.com",
      ownerName: "Carlos Owner",
      patientName: "Ana Multi",
    });
    expect(call[0].requestedAt).toBeInstanceOf(Date);
  });

  it("still returns 201 and records the request even when one email send fails", async () => {
    (sendDeletionRequestNotificationEmail as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(undefined)        // first owner: succeeds
      .mockRejectedValueOnce(new Error("SMTP error")); // second owner: fails

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]))             // no existing pending request
      .mockReturnValueOnce(makeSelectChain([]))             // no recently cancelled request
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))  // patient lookup
      .mockReturnValueOnce(makeSelectChain(ENROLLMENTS))    // enrollments
      .mockReturnValueOnce(makeSelectChain(OWNER_ROWS));    // owner query

    (db.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeInsertChain([DELETION_REQUEST_ROW]))
      .mockReturnValueOnce(makeInsertChain())
      .mockReturnValueOnce(makeInsertChain());

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain());

    const res = await request(buildApp())
      .post("/patients/me/delete-request")
      .send({});

    // The handler catches email errors individually — the request must still succeed
    expect(res.status).toBe(201);
    expect(sendDeletionRequestNotificationEmail).toHaveBeenCalledTimes(2);
  });
});
