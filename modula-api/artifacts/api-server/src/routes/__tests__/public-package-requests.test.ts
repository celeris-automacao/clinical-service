import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
  requireAuth: vi.fn(),
  resolveOwnerClinicId: vi.fn(),
  resolveSecretaryClinicId: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { select: mocks.select, insert: mocks.insert, transaction: mocks.transaction },
  carePackagesTable: {},
  carePackageSlotsTable: {},
  patientPackagesTable: {},
  patientPackageDoctorsTable: {},
  patientDoctorsTable: {},
  doctorsTable: {},
  usersTable: {},
  clinicOwnersTable: {},
  patientClinicsTable: {},
  leadsTable: {},
  clinicSettingsTable: {},
  clinicsTable: {},
  clinicPublicPagesTable: {},
  clinicGalleryPhotosTable: {},
  carePackagePromotionUploadsTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn(), count: vi.fn(), sql: vi.fn(), inArray: vi.fn(), isNull: vi.fn(),
}));
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: mocks.requireAuth,
  isError: (value: unknown) => Boolean(value && typeof value === "object" && "error" in value),
  resolveOwnerClinicId: mocks.resolveOwnerClinicId,
  resolveSecretaryClinicId: mocks.resolveSecretaryClinicId,
}));

import packagesRouter from "../packages";

const app = express();
app.use(express.json(), (req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn(), warn: vi.fn() } });
  next();
}, packagesRouter);

function queryRows(result: unknown[]) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => result,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function selectResults(...results: unknown[][]) {
  for (const result of results) mocks.select.mockReturnValueOnce(queryRows(result));
}

const interest = {
  name: "Maria Visitante",
  contact: "(11) 99999-1234",
  consent: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback({
    select: mocks.select,
    insert: mocks.insert,
    execute: mocks.execute,
  }));
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
});

describe("public package endpoint", () => {
  it("allows clinic secretaries to list programs for internal promotion", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { id: 21, role: "secretaria" },
      clinicId: 3,
    });
    mocks.resolveSecretaryClinicId.mockResolvedValue(3);
    selectResults(
      [{ id: 7, clinicId: 3, name: "Programa Bem-Estar", description: null, durationDays: 60, priceCents: 25000, active: true, createdAt: new Date("2026-01-01T10:00:00.000Z") }],
      [{ quantity: 2 }],
      [{ cnt: 0 }],
    );

    const response = await request(app).get("/packages");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ id: 7, name: "Programa Bem-Estar", active: true }),
    ]);
  });

  it("only returns active packages and their assigned professional names", async () => {
    selectResults(
      [{ id: 7, clinicId: 3, name: "Programa Bem-Estar", description: "Descrição", durationDays: 60, priceCents: 25000, active: true, promotionImages: ["/objects/promo.webp"] }],
      [{ name: "Clínica Exemplo", logoUrl: "/objects/legacy-logo.png", primaryColor: "#16a34a" }],
      [{ clinicName: "Clínica São João - Coração Íris", logoUrl: "/objects/logo.png" }],
      [{ slug: "clinica-exemplo" }],
      [{ doctorId: 20, specialty: "nutritionist", quantity: 2 }],
      [{ id: 20, name: "Dra. Ana", specialty: "nutritionist" }],
    );

    const response = await request(app).get("/public/packages/7");

    expect(response.status).toBe(200);
    expect(response.body.slots).toEqual([
      { doctorName: "Dra. Ana", specialty: "nutritionist", quantity: 2 },
    ]);
    expect(response.body.clinicName).toBe("Clínica São João - Coração Íris");
    expect(response.body.clinicLogoUrl).toBe("/objects/logo.png");
    expect(response.body.images).toEqual([{ url: "/objects/promo.webp", caption: null }]);
  });

  it("does not fall back to a legacy logo after the owner removes the configured logo", async () => {
    selectResults(
      [{ id: 7, clinicId: 3, name: "Programa Bem-Estar", description: null, durationDays: 60, priceCents: 25000, active: true, promotionImages: [] }],
      [{ name: "Clínica Exemplo", logoUrl: "/objects/legacy-logo.png", primaryColor: "#16a34a" }],
      [{ clinicName: "Clínica Exemplo", logoUrl: null }],
      [{ slug: "clinica-exemplo" }],
      [],
    );

    const response = await request(app).get("/public/packages/7");

    expect(response.status).toBe(200);
    expect(response.body.clinicLogoUrl).toBeNull();
  });

  it("does not accept an invalid visitor request", async () => {
    const response = await request(app)
      .post("/public/packages/7/contact-requests")
      .send({ ...interest, consent: false });

    expect(response.status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("records a consented interest as a new lead for the package's clinic", async () => {
    selectResults(
      [{ id: 7, clinicId: 3, name: "Programa Bem-Estar" }],
      [{ userId: 17 }],
      [],
    );

    const response = await request(app)
      .post("/public/packages/7/contact-requests")
      .send(interest);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ received: true });
    expect(mocks.values).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      clinicId: 3,
      authorUserId: 17,
      name: interest.name,
      contact: interest.contact,
      source: "Interesse em programa: Programa Bem-Estar",
      status: "novo",
    }));
  });

  it("does not create duplicate leads for retry submissions", async () => {
    selectResults(
      [{ id: 7, clinicId: 3, name: "Programa Bem-Estar" }],
      [{ userId: 17 }],
      [{ id: 99 }],
    );

    expect((await request(app).post("/public/packages/7/contact-requests").send(interest)).status).toBe(201);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
