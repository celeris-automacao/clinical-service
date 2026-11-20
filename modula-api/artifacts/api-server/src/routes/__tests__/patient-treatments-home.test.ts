import { beforeEach, describe, expect, it, vi } from "vitest";
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
  patientDoctorsTable: {},
  doctorsTable: {},
  doctorInsurancesTable: {},
  weightEntriesTable: {},
  xpEntriesTable: {},
  checkInsTable: {},
  clinicSettingsTable: {},
  patientClinicsTable: {},
  clinicOwnersTable: {},
  dataAccessLogTable: {},
  auditFailuresTable: {},
  staffEventsTable: {},
  auditAlertCooldownTable: {},
  carePackagesTable: {},
  patientPackagesTable: {},
  patientPackageDoctorsTable: {},
  clinicsTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((result: unknown) => Boolean(result && typeof result === "object" && "error" in (result as object))),
}));

import { db } from "@workspace/db";
import { requireAuth } from "../../lib/auth-helpers";
import patientsRouter from "../patients";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use(patientsRouter);
  return app;
}

function makeChain(result: unknown): any {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.then = (onFulfilled: any, onRejected: any) => Promise.resolve(result).then(onFulfilled, onRejected);
  chain.catch = (onRejected: any) => Promise.resolve(result).catch(onRejected);
  return chain;
}

describe("GET /patients/me/treatments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active treatments grouped by clinic", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: 7, role: "patient", name: "Ana Paciente" },
    } as any);

    const select = vi.mocked(db.select);
    select
      .mockReturnValueOnce(makeChain([{ id: 42, userId: 7 }]))
      .mockReturnValueOnce(makeChain([{ name: "Ana Paciente" }]))
      .mockReturnValueOnce(
        makeChain([
          {
            enrollmentId: 10,
            packageId: 100,
            packageName: "Emagrecimento",
            packageDescription: "Programa de 90 dias",
            clinicId: 1,
            clinicName: "Clínica Vida",
            clinicLogoUrl: null,
            startDate: new Date("2026-01-10T00:00:00.000Z"),
            endDate: new Date("2026-04-10T00:00:00.000Z"),
          },
          {
            enrollmentId: 11,
            packageId: 101,
            packageName: "Nutrição",
            packageDescription: null,
            clinicId: 2,
            clinicName: "Clínica Estética",
            clinicLogoUrl: "https://cdn.example/logo.png",
            startDate: new Date("2026-02-01T00:00:00.000Z"),
            endDate: new Date("2026-05-01T00:00:00.000Z"),
          },
        ])
      )
      .mockReturnValueOnce(
        makeChain([
          { enrollmentId: 10, doctorId: 501, doctorName: "Dra. Sofia", specialty: "nutrição" },
          { enrollmentId: 11, doctorId: 502, doctorName: "Dr. Bruno", specialty: "endocrinologia" },
        ])
      );

    const res = await request(buildApp()).get("/patients/me/treatments");

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(42);
    expect(res.body.patientName).toBe("Ana Paciente");
    expect(res.body.clinics).toHaveLength(2);
    expect(res.body.clinics[0]).toMatchObject({
      clinicId: 1,
      clinicName: "Clínica Vida",
      treatments: [
        expect.objectContaining({
          packageName: "Emagrecimento",
          status: "active",
          doctors: [expect.objectContaining({ doctorName: "Dra. Sofia" })],
        }),
      ],
    });
  });

  it("returns an empty clinic list when there are no active treatments", async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      user: { id: 7, role: "patient", name: "Ana Paciente" },
    } as any);

    vi.mocked(db.select)
      .mockReturnValueOnce(makeChain([{ id: 42, userId: 7 }]))
      .mockReturnValueOnce(makeChain([{ name: "Ana Paciente" }]))
      .mockReturnValueOnce(makeChain([]));

    const res = await request(buildApp()).get("/patients/me/treatments");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ patientId: 42, patientName: "Ana Paciente", clinics: [] });
  });
});
