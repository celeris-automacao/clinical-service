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
  patientDoctorsTable: {},
  doctorsTable: {},
  weightEntriesTable: {},
  xpEntriesTable: {},
  checkInsTable: {},
  clinicSettingsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  staffEventsTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn(),
  ensureClinicAccess: vi.fn(),
  ACCESS_TOKEN_PREFIX: "clinic_pat_",
  hashAccessToken: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendTempPasswordEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn().mockResolvedValue("hashed_pw"),
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import patientsRouter from "../patients";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((_req: any, _res: any, next: any) => {
    (_req as any).log = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };
    next();
  });
  app.use(patientsRouter);
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

function makeUpdateChain(): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn().mockResolvedValue([]);
  return chain;
}

const DOCTOR_USER = {
  id: 2,
  role: "profissional_saude" as const,
  email: "doctor-a@clinic.com",
  name: "Dra. Ana",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  isTemporaryPassword: false,
  avatarUrl: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Doctor A belongs to clinic 111 ("Clinic A"). Any patient this doctor
// creates must be enrolled ONLY in clinic 111, never in any other clinic —
// no matter what the request body tries to smuggle in.
const DOCTOR_A_RECORD = {
  id: 20,
  userId: DOCTOR_USER.id,
  clinicId: 111,
};

const NEW_USER_ROW = {
  id: 50,
  email: "novo.paciente@teste.com",
  name: "Novo Paciente",
  role: "patient",
  clerkId: "manual_5000",
  passwordHash: "hashed_pw",
  isTemporaryPassword: true,
  avatarUrl: null,
  accessToken: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const NEW_PATIENT_ROW = {
  id: 30,
  userId: NEW_USER_ROW.id,
  startWeight: "90",
  targetWeight: "75",
  phone: "11999999999",
  dateOfBirth: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REQUIRED_PATIENT_DETAILS = {
  dateOfBirth: "1991-06-20",
  rg: "12.345.678-9",
  addressStreet: "Rua das Flores",
  addressNumber: "123",
  addressNeighborhood: "Centro",
  addressCity: "São Paulo",
  addressState: "SP",
  addressZip: "01001-000",
};

// ── POST /patients — doctor clinic scoping ──────────────────────────────────

/**
 * Guards the invariant described in the task: a doctor can only ever enroll
 * a newly created patient in their OWN clinic (resolved server-side from
 * doctorsTable.clinicId), and only ever assigns the patient to themselves.
 * The request body has no clinicId/doctorId field a client could spoof
 * (see CreatePatientBody in lib/api-zod), so these tests also exercise
 * adversarial payloads that attempt to inject one anyway.
 */
describe("POST /patients — doctor clinic scoping (prevents cross-clinic enrollment)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function mockDoctorCreationFlow() {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });

    // 1st select: doctorsTable lookup by userId → doctor's own clinicId
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]))
      // CPF identity lookup: this is a new patient.
      .mockReturnValueOnce(makeSelectChain([]))
      // Resolve eligible doctors for the clinic enrollment.
      .mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]))
      // buildPatientResponse: weight entries, then XP sum
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      // fetchClinicBranding (fire-and-forget)
      .mockReturnValueOnce(makeSelectChain([]));

    const mockReturning = vi
      .fn()
      .mockResolvedValueOnce([NEW_USER_ROW])
      .mockResolvedValueOnce([NEW_PATIENT_ROW]);
    const mockValues = vi.fn((_values: unknown) => ({
      returning: mockReturning,
      onConflictDoNothing: vi.fn(),
      catch: vi.fn().mockResolvedValue(undefined),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    return mockValues;
  }

  it("enrolls the patient only in the doctor's own clinic and assigns only that doctor", async () => {
    const mockValues = mockDoctorCreationFlow();

    const res = await request(buildApp()).post("/patients").send({
      ...REQUIRED_PATIENT_DETAILS,
      name: "Novo Paciente",
      email: "novo.paciente@teste.com",
      phone: "11999999999",
      cpf: "11144477735",
      startWeight: 90,
      targetWeight: 75,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(201);

    // Calls to db.insert() happen in order: usersTable, patientsTable,
    // patientClinicsTable, patientDoctorsTable, identity audit event.
    const insertCalls = (db.insert as ReturnType<typeof vi.fn>).mock.calls;
    expect(insertCalls.length).toBe(5);

    // patientClinicsTable insert (3rd call) must use the doctor's own clinicId (111)
    const patientInsertArgs = mockValues.mock.calls[1]?.[0] as { phone: string };
    expect(patientInsertArgs.phone).toBe("11999999999");

    const clinicInsertArgs = mockValues.mock.calls[2]?.[0] as { patientId: number; clinicId: number };
    expect(clinicInsertArgs).toEqual({ patientId: NEW_PATIENT_ROW.id, clinicId: DOCTOR_A_RECORD.clinicId });

    // patientDoctorsTable insert (4th call) must link only to this doctor's id (20)
    const doctorInsertArgs = mockValues.mock.calls[3]?.[0] as { patientId: number; doctorId: number }[];
    expect(doctorInsertArgs).toEqual([{ patientId: NEW_PATIENT_ROW.id, doctorId: DOCTOR_A_RECORD.id }]);
  });

  it("ignores an adversarial clinicId/doctorId injected in the request body", async () => {
    const mockValues = mockDoctorCreationFlow();

    const res = await request(buildApp())
      .post("/patients")
      .send({
        ...REQUIRED_PATIENT_DETAILS,
        name: "Novo Paciente",
        email: "novo.paciente@teste.com",
        phone: "11999999999",
        cpf: "11144477735",
        startWeight: 90,
        targetWeight: 75,
        // Adversarial fields — not part of CreatePatientBody, must be ignored entirely.
        clinicId: 999,
        doctorId: 999,
      });

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(res.status).toBe(201);

    const clinicInsertArgs = mockValues.mock.calls[2]?.[0] as { patientId: number; clinicId: number };
    const doctorInsertArgs = mockValues.mock.calls[3]?.[0] as { patientId: number; doctorId: number }[];

    // Enrollment must still resolve to the doctor's real clinic/id (111/20),
    // never the spoofed values (999) from the request body.
    expect(clinicInsertArgs.clinicId).toBe(111);
    expect(clinicInsertArgs.clinicId).not.toBe(999);
    expect(doctorInsertArgs[0].doctorId).toBe(20);
    expect(doctorInsertArgs[0].doctorId).not.toBe(999);
  });

  it("rejects a missing required patient detail while allowing the address complement to be omitted", async () => {
    const { addressCity: _addressCity, ...detailsWithoutCity } = REQUIRED_PATIENT_DETAILS;
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]));

    const res = await request(buildApp()).post("/patients").send({
      ...detailsWithoutCity,
      name: "Novo Paciente",
      email: "novo.paciente@teste.com",
      phone: "11999999999",
      cpf: "11144477735",
      startWeight: 90,
      targetWeight: 75,
    });

    expect(res.status).toBe(400);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("reuses and enrolls an existing patient profile from another clinic instead of creating a duplicate", async () => {
    const existingUser = {
      ...NEW_USER_ROW,
      id: 49,
      email: "existing.patient@teste.invalid",
      name: "Paciente Existente",
      cpf: "11144477735",
      isTemporaryPassword: false,
    };
    const existingPatient = {
      ...NEW_PATIENT_ROW,
      id: 29,
      userId: existingUser.id,
      clinicId: 222,
      cpf: existingUser.cpf,
      phone: null,
    };
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]))
      .mockReturnValueOnce(makeSelectChain([existingUser]))
      .mockReturnValueOnce(makeSelectChain([existingPatient]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const mockValues = vi.fn((_values: unknown) => ({
      returning: vi.fn().mockResolvedValue([]),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      catch: vi.fn().mockResolvedValue(undefined),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });
    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp()).post("/patients").send({
      ...REQUIRED_PATIENT_DETAILS,
      name: "Paciente Existente",
      email: "existing.patient@teste.invalid",
      phone: "11999999999",
      cpf: "11144477735",
      startWeight: 80,
      targetWeight: 65,
      confirmIdentity: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: existingPatient.id,
      userId: existingUser.id,
      match: "found",
      linkedToCurrentClinic: true,
    });
    expect(res.body.phone).toBe("11999999999");
    expect(updateChain.set).toHaveBeenCalledWith({ phone: "11999999999" });
    expect(db.insert).toHaveBeenCalledTimes(3);
    expect(mockValues.mock.calls[0]?.[0]).toEqual({
      patientId: existingPatient.id,
      clinicId: DOCTOR_A_RECORD.clinicId,
    });
    expect(mockValues.mock.calls[1]?.[0]).toEqual([
      { patientId: existingPatient.id, doctorId: DOCTOR_A_RECORD.id },
    ]);
    expect(mockValues.mock.calls.some(([values]) =>
      values && typeof values === "object" && "startWeight" in values
    )).toBe(false);
  });

  it("enrolls an existing patient in the owner's clinic and selected care team", async () => {
    const ownerUser = { ...DOCTOR_USER, id: 3, role: "clinic_owner" as const };
    const existingUser = {
      ...NEW_USER_ROW,
      id: 49,
      email: "existing.patient@teste.invalid",
      name: "Paciente Existente",
      cpf: "11144477735",
      isTemporaryPassword: false,
    };
    const existingPatient = {
      ...NEW_PATIENT_ROW,
      id: 29,
      userId: existingUser.id,
      clinicId: 222,
      cpf: existingUser.cpf,
      phone: null,
    };
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: ownerUser,
      clinicId: DOCTOR_A_RECORD.clinicId,
    });
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([existingUser]))
      .mockReturnValueOnce(makeSelectChain([existingPatient]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([DOCTOR_A_RECORD]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ total: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]));

    const mockValues = vi.fn((_values: unknown) => ({
      returning: vi.fn().mockResolvedValue([]),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      catch: vi.fn().mockResolvedValue(undefined),
    }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });
    const updateChain = makeUpdateChain();
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue(updateChain);

    const res = await request(buildApp()).post("/patients").send({
      ...REQUIRED_PATIENT_DETAILS,
      name: "Paciente Existente",
      email: "existing.patient@teste.invalid",
      phone: "11999999999",
      cpf: "11144477735",
      startWeight: 80,
      targetWeight: 65,
      additionalDoctorIds: [DOCTOR_A_RECORD.id],
      confirmIdentity: true,
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: existingPatient.id,
      userId: existingUser.id,
      linkedToCurrentClinic: true,
    });
    expect(res.body.phone).toBe("11999999999");
    expect(updateChain.set).toHaveBeenCalledWith({ phone: "11999999999" });
    expect(mockValues.mock.calls[0]?.[0]).toEqual({
      patientId: existingPatient.id,
      clinicId: DOCTOR_A_RECORD.clinicId,
    });
    expect(mockValues.mock.calls[1]?.[0]).toEqual([
      { patientId: existingPatient.id, doctorId: DOCTOR_A_RECORD.id },
    ]);
  });

  it("returns 403 and creates nothing when the caller has no doctor record", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });
    // doctorsTable lookup finds nothing
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeSelectChain([]));

    const res = await request(buildApp()).post("/patients").send({
      name: "Novo Paciente",
      email: "novo.paciente@teste.com",
      phone: "11999999999",
      cpf: "11144477735",
      startWeight: 90,
    });

    expect(res.status).toBe(403);
    expect(db.insert as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });
});
