import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock heavy dependencies before any local imports ────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  patientsTable: {},
  patientDoctorsTable: {},
  doctorsTable: {},
  usersTable: {},
  clinicSettingsTable: {},
}));

vi.mock("../email", () => ({
  sendBirthdayNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { sendBirthdayNotificationEmail } from "../email";
import { logger } from "../logger";
import { runBirthdayNotifications } from "../birthdayJob";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a drizzle-style chainable thenable for select queries.
 * Resolves to `data` when awaited at any point in the chain.
 */
function makeSelectChain(data: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  chain.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(data).then(onFulfilled, onRejected);
  chain.catch = (handler: any) => Promise.resolve(data).catch(handler);
  return chain;
}

// ── Fixture data ─────────────────────────────────────────────────────────────

const PATIENT_NO_DOCTOR = {
  patient: {
    id: 1,
    userId: 10,
    dateOfBirth: "1990-07-01",
  },
  user: {
    id: 10,
    name: "Ana Sem Médico",
    email: "ana@teste.com",
  },
};

const PATIENT_WITH_DOCTOR = {
  patient: {
    id: 2,
    userId: 20,
    dateOfBirth: "1985-07-01",
  },
  user: {
    id: 20,
    name: "Bruno Com Médico",
    email: "bruno@teste.com",
  },
};

const DOCTOR_USER = {
  doctor: { id: 99, userId: 30 },
  user: {
    id: 30,
    name: "Dr. Silva",
    email: "dr.silva@clinica.com",
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runBirthdayNotifications — patient with no assigned doctor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes without throwing when the only birthday patient has no assigned staff", async () => {
    // select 1: todayPatients → patient with no doctor
    // select 2: fetchClinicBranding → no settings
    // select 3: assignedStaff for that patient → empty
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_NO_DOCTOR]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    await expect(runBirthdayNotifications()).resolves.toBeUndefined();
  });

  it("logs the expected skip message when a birthday patient has no assigned staff", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_NO_DOCTOR]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    await runBirthdayNotifications();

    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls;
    const skipCall = infoCalls.find(
      (args) =>
        typeof args[1] === "string" &&
        args[1].includes("no assigned staff, skipping")
    );
    expect(skipCall).toBeDefined();
    expect(skipCall![0]).toMatchObject({ patientId: PATIENT_NO_DOCTOR.patient.id });
  });

  it("does not send any email when the only birthday patient has no assigned staff", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_NO_DOCTOR]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    await runBirthdayNotifications();

    expect(sendBirthdayNotificationEmail).not.toHaveBeenCalled();
  });

  it("still sends email to the assigned doctor of a second patient on the same run", async () => {
    // Two birthday patients on the same day:
    //   patient 1 — no assigned staff → should be skipped
    //   patient 2 — one assigned doctor → email must be sent
    //
    // select sequence:
    //   1. todayPatients → [PATIENT_NO_DOCTOR, PATIENT_WITH_DOCTOR]
    //   2. fetchClinicBranding → []
    //   3. assignedStaff for PATIENT_NO_DOCTOR → []
    //   4. assignedStaff for PATIENT_WITH_DOCTOR → [DOCTOR_USER]
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_NO_DOCTOR, PATIENT_WITH_DOCTOR]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([DOCTOR_USER]));

    await runBirthdayNotifications();

    expect(sendBirthdayNotificationEmail).toHaveBeenCalledOnce();
    const emailArgs = (sendBirthdayNotificationEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(emailArgs.to).toBe(DOCTOR_USER.user.email);
    expect(emailArgs.patientName).toBe(PATIENT_WITH_DOCTOR.user.name);
  });

  it("does not crash when no patients have birthdays today", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([]));

    await expect(runBirthdayNotifications()).resolves.toBeUndefined();
    expect(sendBirthdayNotificationEmail).not.toHaveBeenCalled();
  });
});
