import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @workspace/db before importing the module under test ──────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  usersTable: {},
  patientsTable: {},
  doctorsTable: {},
  patientDoctorsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
}));

import { db } from "@workspace/db";
import { ensurePatientAccess } from "../auth-helpers";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(data: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(data);
  return chain;
}

const PATIENT_ROW = {
  id: 30,
  userId: 50,
  startWeight: "90",
  targetWeight: "75",
  dateOfBirth: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Doctor B belongs to Clinic B (222). The patient is enrolled ONLY in Clinic A (111).
const DOCTOR_B_RECORD = {
  id: 21,
  userId: 3,
  clinicId: 222,
};

/**
 * Regression coverage for the risk described in the task: `ensurePatientAccess`
 * is the single gate used by GET/PATCH /patients/:patientId (and every other
 * patient-scoped route). A doctor whose clinicId does not match the patient's
 * clinic enrollment must always be denied — even if a patient_doctors link
 * somehow exists (e.g. stale data, migration artifact, or a bug elsewhere
 * that created the link). Cross-clinic access must fail closed.
 */
describe("ensurePatientAccess — cross-clinic denial for profissional_saude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies access when the doctor's clinic differs from the patient's enrollment, even with a patient_doctors link", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      // 1. patientsTable lookup by id
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))
      // 2. doctorsTable lookup by userId -> doctor B, clinic 222
      .mockReturnValueOnce(makeSelectChain([DOCTOR_B_RECORD]))
      // 3. patientDoctorsTable link lookup -> link EXISTS (assigned despite clinic mismatch)
      .mockReturnValueOnce(makeSelectChain([{ patientId: PATIENT_ROW.id, doctorId: DOCTOR_B_RECORD.id }]))
      // 4. patientClinicsTable enrollment lookup for clinic 222 -> NOT enrolled
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await ensurePatientAccess(
      { id: DOCTOR_B_RECORD.userId, role: "profissional_saude" },
      PATIENT_ROW.id
    );

    expect(result).toBeNull();
  });

  it("denies access when there is no patient_doctors link at all (baseline)", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))
      .mockReturnValueOnce(makeSelectChain([DOCTOR_B_RECORD]))
      // no link
      .mockReturnValueOnce(makeSelectChain([]));

    const result = await ensurePatientAccess(
      { id: DOCTOR_B_RECORD.userId, role: "profissional_saude" },
      PATIENT_ROW.id
    );

    expect(result).toBeNull();
  });

  it("grants access only when the doctor is linked AND the patient is enrolled in the doctor's own clinic", async () => {
    const DOCTOR_A_RECORD = { id: 20, userId: 2, clinicId: 111 };

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([PATIENT_ROW]))
      .mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]))
      .mockReturnValueOnce(makeSelectChain([{ patientId: PATIENT_ROW.id, doctorId: DOCTOR_A_RECORD.id }]))
      .mockReturnValueOnce(makeSelectChain([{ patientId: PATIENT_ROW.id, clinicId: DOCTOR_A_RECORD.clinicId }]));

    const result = await ensurePatientAccess(
      { id: DOCTOR_A_RECORD.userId, role: "profissional_saude" },
      PATIENT_ROW.id
    );

    expect(result).toEqual(PATIENT_ROW);
  });
});
