import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
  appointmentsTable: {},
  appointmentReviewsTable: {},
  doctorsTable: {},
  usersTable: {},
  patientsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  professionalAvailabilityTable: {},
  expensesTable: {},
  staffEventsTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((result: unknown) => "error" in (result as object)),
  resolveOwnerClinicId: vi.fn().mockResolvedValue(1),
}));

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import financeRouter from "../finance";
import appointmentsRouter from "../appointments";

const OWNER_AUTH = { user: { id: 1, role: "clinic_owner" as const }, clinicId: 1 };
const SECRETARY_AUTH = { user: { id: 2, role: "secretaria" as const }, clinicId: 1 };
const DOCTOR_AUTH = { user: { id: 3, role: "profissional_saude" as const }, clinicId: 1 };

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(financeRouter);
  app.use(appointmentsRouter);
  return app;
}

function makeSelectChain(result: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(result);
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  chain.catch = (handler: any) => Promise.resolve(result).catch(handler);
  return chain;
}

function makeInsertChain(returnValue: unknown): any {
  const chain: any = {};
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  chain.then = (resolve: any, reject: any) => Promise.resolve(returnValue).then(resolve, reject);
  chain.catch = (handler: any) => Promise.resolve(returnValue).catch(handler);
  return chain;
}

function makeUpdateChain(returnValue: unknown): any {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

function makeDeleteChain(): any {
  const chain: any = {};
  chain.where = vi.fn(() => chain);
  chain.then = (resolve: any, reject: any) => Promise.resolve(undefined).then(resolve, reject);
  chain.catch = (handler: any) => Promise.resolve(undefined).catch(handler);
  return chain;
}

function mockSelectResponses(...responses: unknown[]) {
  const select = db.select as unknown as ReturnType<typeof vi.fn>;
  const queue = [...responses];
  select.mockReset();
  select.mockImplementation(() => makeSelectChain(queue.shift() ?? []));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("finance integration", () => {
  it("recomputes revenue, commissions and summary from appointments", async () => {
    (requireAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_AUTH);
    mockSelectResponses(
      [
        { id: 10, doctorId: 101, patientId: 201, clinicId: 1, date: "2026-08-10", amountCharged: "100.00", isPaid: true, paymentMethod: "pix", status: "scheduled" },
        { id: 11, doctorId: 101, patientId: 202, clinicId: 1, date: "2026-08-11", amountCharged: "80.00", isPaid: false, paymentMethod: null, status: "scheduled" },
      ],
      [{ id: 101, userId: 301, clinicId: 1 }],
      [{ id: 201, userId: 401, paymentType: "particular" }, { id: 202, userId: 402, paymentType: "convenio" }],
      [{ id: 301, name: "Dra. Alpha" }, { id: 401, name: "Paciente 1" }, { id: 402, name: "Paciente 2" }],
      [{ id: 101, userId: 301, clinicId: 1, commissionPercent: 20 }, { id: 102, userId: 302, clinicId: 1, commissionPercent: 30 }],
      [{ id: 301, name: "Dra. Alpha" }],
      [{ id: 302, name: "Dr. Beta" }],
      [{ id: 10, doctorId: 101, patientId: 201, clinicId: 1, date: "2026-08-10", amountCharged: "100.00", isPaid: true, paymentMethod: "pix", status: "scheduled" }],
      [{ id: 1, clinicId: 1, amount: "25.00", period: "2026-08", description: "Aluguel", category: "salario", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-01T10:00:00Z") }]
    );

    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain([]));
    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeUpdateChain([]));
    (db.delete as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    const app = buildApp();
    const revenueRes = await request(app).get("/finance/revenue").query({ period: "2026-08" });
    expect(revenueRes.status).toBe(200);
    expect(revenueRes.body.totalPaid).toBe(100);
    expect(revenueRes.body.totalPending).toBe(80);
    expect(revenueRes.body.totalRevenue).toBe(180);
    expect(revenueRes.body.byPaymentType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Particular", paid: 100, pending: 0, total: 100 }),
        expect.objectContaining({ label: "Convênio", paid: 0, pending: 80, total: 80 }),
      ])
    );

    mockSelectResponses(
      [{ id: 101, userId: 301, clinicId: 1, commissionPercent: 20 }, { id: 102, userId: 302, clinicId: 1, commissionPercent: 30 }],
      [{ id: 10, doctorId: 101, patientId: 201, clinicId: 1, date: "2026-08-10", amountCharged: "100.00", isPaid: true, paymentMethod: "pix", status: "scheduled" }],
      [{ id: 301, name: "Dra. Alpha" }],
      [{ id: 302, name: "Dr. Beta" }]
    );
    const commissionsRes = await request(app).get("/finance/commissions").query({ period: "2026-08" });
    expect(commissionsRes.status).toBe(200);
    expect(commissionsRes.body).toEqual([
      expect.objectContaining({ doctorId: 101, commissionPercent: 20, revenue: 100, commissionAmount: 20 }),
      expect.objectContaining({ doctorId: 102, commissionPercent: 30, revenue: 0, commissionAmount: 0 }),
    ]);

    mockSelectResponses(
      [{ id: 10, doctorId: 101, patientId: 201, clinicId: 1, date: "2026-08-10", amountCharged: "100.00", isPaid: true, paymentMethod: "pix", status: "scheduled" }],
      [{ id: 1, clinicId: 1, amount: "25.00", period: "2026-08", description: "Aluguel", category: "salario", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-01T10:00:00Z") }]
    );
    const summaryRes = await request(app).get("/finance/summary").query({ period: "2026-08" });
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.totalRevenue).toBe(100);
    expect(summaryRes.body.totalExpenses).toBe(25);
    expect(summaryRes.body.cashBalance).toBe(75);
  });

  it("creates, updates and deletes expenses", async () => {
    (requireAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_AUTH);

    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeInsertChain([
        { id: 2, clinicId: 1, category: "outro", description: "Nova", amount: "30.00", period: "2026-08", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-03T10:00:00Z"), updatedAt: new Date("2026-08-03T10:00:00Z") },
      ])
    );
    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeUpdateChain([
        { id: 1, clinicId: 1, category: "salario", description: "Despesa QA editada", amount: "15.00", period: "2026-08", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-02T10:00:00Z") },
      ])
    );
    (db.delete as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeDeleteChain());

    const app = buildApp();
    mockSelectResponses([{ id: 99, name: "Owner" }]);
    const createRes = await request(app).post("/finance/expenses").send({
      category: "outro",
      description: "Nova",
      amount: 30,
      period: "2026-08",
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.amount).toBe(30);

    mockSelectResponses(
      [{ id: 1, clinicId: 1, category: "outro", description: "Despesa QA", amount: "10.00", period: "2026-08", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-01T10:00:00Z") }],
      [{ id: 1, clinicId: 1, category: "salario", description: "Despesa QA editada", amount: "15.00", period: "2026-08", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-02T10:00:00Z") }],
      [{ id: 99, name: "Owner" }]
    );
    const updateRes = await request(app).patch("/finance/expenses/1").send({ description: "Despesa QA editada" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.description).toBe("Despesa QA editada");

    mockSelectResponses([
      { id: 1, clinicId: 1, category: "salario", description: "Despesa QA editada", amount: "15.00", period: "2026-08", receiptUrl: null, createdByUserId: 1, createdAt: new Date("2026-08-01T10:00:00Z"), updatedAt: new Date("2026-08-02T10:00:00Z") },
    ]);
    const deleteRes = await request(app).delete("/finance/expenses/1");
    expect(deleteRes.status).toBe(204);
  });

  it("updates appointment payment fields and blocks professionals", async () => {
    (requireAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_AUTH);
    mockSelectResponses(
      [
        {
          id: 5,
          patientId: 11,
          doctorId: 22,
          clinicId: 1,
          date: "2026-08-10",
          startTime: "10:00",
          endTime: "10:30",
          status: "scheduled",
          modality: "presencial",
          meetingLink: null,
          cancelReason: null,
          priceType: "particular",
          doctorInsuranceId: null,
          amountCharged: "100.00",
          paymentMethod: null,
          createdAt: new Date("2026-08-01T10:00:00Z"),
          isPaid: false,
          paidBy: null,
          paymentNotes: null,
          paymentProofUrl: null,
          paymentRecordedAt: null,
          paymentRecordedByUserId: null,
        },
      ],
      [{ name: "Paciente QA" }],
      [{ name: "Dra. QA", consultationPrice: "100.00" }],
      []
    );

    const updateSet = vi.fn();
    (db.update as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      set: (value: any) => {
        updateSet(value);
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 5,
                patientId: 11,
                doctorId: 22,
                clinicId: 1,
                date: "2026-08-10",
                startTime: "10:00",
                endTime: "10:30",
                status: "scheduled",
                modality: "presencial",
                meetingLink: null,
                cancelReason: null,
                priceType: "particular",
                doctorInsuranceId: null,
                amountCharged: "100.00",
                paymentMethod: "pix",
                createdAt: new Date("2026-08-01T10:00:00Z"),
                isPaid: true,
                paidBy: "Paciente QA",
                paymentNotes: "ok",
                paymentProofUrl: null,
                paymentRecordedAt: new Date("2026-08-05T12:00:00Z"),
                paymentRecordedByUserId: 1,
              },
            ]),
          }),
        };
      },
    });
    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain([]));

    const app = buildApp();
    const paidRes = await request(app).patch("/appointments/5").send({
      isPaid: true,
      paymentMethod: "pix",
      paidBy: "Paciente QA",
      paymentNotes: "ok",
    });
    expect(paidRes.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        isPaid: true,
        paymentMethod: "pix",
        paidBy: "Paciente QA",
        paymentNotes: "ok",
        paymentRecordedByUserId: 1,
      })
    );
    expect(paidRes.body.paymentRecordedAt).toBeTruthy();

    (requireAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(DOCTOR_AUTH);
    mockSelectResponses([
      {
        id: 5,
        patientId: 11,
        doctorId: 22,
        clinicId: 1,
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "10:30",
        status: "scheduled",
        modality: "presencial",
        meetingLink: null,
        cancelReason: null,
        priceType: "particular",
        doctorInsuranceId: null,
        amountCharged: "100.00",
        paymentMethod: null,
        createdAt: new Date("2026-08-01T10:00:00Z"),
        isPaid: false,
        paidBy: null,
        paymentNotes: null,
        paymentProofUrl: null,
        paymentRecordedAt: null,
        paymentRecordedByUserId: null,
      },
    ]);
    const forbiddenRes = await request(app).patch("/appointments/5").send({ isPaid: false });
    expect(forbiddenRes.status).toBe(403);
  });

  it("rejects invalid expense and appointment values", async () => {
    (requireAuth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(OWNER_AUTH);
    (db.insert as unknown as ReturnType<typeof vi.fn>).mockReturnValue(makeInsertChain([]));
    mockSelectResponses([{ id: 99, name: "Owner" }], [
      {
        id: 5,
        patientId: 11,
        doctorId: 22,
        clinicId: 1,
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "10:30",
        status: "scheduled",
        modality: "presencial",
        meetingLink: null,
        cancelReason: null,
        priceType: "particular",
        doctorInsuranceId: null,
        amountCharged: "100.00",
        paymentMethod: null,
        createdAt: new Date("2026-08-01T10:00:00Z"),
        isPaid: false,
        paidBy: null,
        paymentNotes: null,
        paymentProofUrl: null,
        paymentRecordedAt: null,
        paymentRecordedByUserId: null,
      },
    ]);

    const app = buildApp();
    const invalidExpense = await request(app).post("/finance/expenses").send({
      category: "outro",
      description: "Nova",
      amount: -1,
      period: "2026-08",
    });
    expect(invalidExpense.status).toBe(400);

    mockSelectResponses([
      {
        id: 5,
        patientId: 11,
        doctorId: 22,
        clinicId: 1,
        date: "2026-08-10",
        startTime: "10:00",
        endTime: "10:30",
        status: "scheduled",
        modality: "presencial",
        meetingLink: null,
        cancelReason: null,
        priceType: "particular",
        doctorInsuranceId: null,
        amountCharged: "100.00",
        paymentMethod: null,
        createdAt: new Date("2026-08-01T10:00:00Z"),
        isPaid: false,
        paidBy: null,
        paymentNotes: null,
        paymentProofUrl: null,
        paymentRecordedAt: null,
        paymentRecordedByUserId: null,
      },
    ]);
    const invalidAppointment = await request(app).patch("/appointments/5").send({
      status: "not-a-valid-status",
    });
    expect(invalidAppointment.status).toBe(400);
  });
});
