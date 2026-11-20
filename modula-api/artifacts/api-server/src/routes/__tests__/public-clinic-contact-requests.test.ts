import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), values: vi.fn(), execute: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@workspace/db", () => ({
  db: { select: mocks.select, insert: mocks.insert, transaction: mocks.transaction },
  clinicPublicPagesTable: {}, clinicPublicServicesTable: {}, clinicGalleryPhotosTable: {},
  clinicsTable: {}, clinicSettingsTable: {}, doctorsTable: {}, usersTable: {}, patientClinicsTable: {},
  patientsTable: {}, appointmentsTable: {}, professionalAvailabilityTable: {}, clinicOwnersTable: {}, leadsTable: {},
}));
vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(), isError: vi.fn(), resolveOwnerClinicId: vi.fn(), resolveCallerClinicId: vi.fn(),
}));
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import publicPageRouter from "../clinic-public-page";

const app = express();
app.use(express.json(), (req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn(), warn: vi.fn() } });
  next();
}, publicPageRouter);
const page = { clinicId: 3 };
const body = {
  name: "Visitante Teste", contact: "(11) 99999-1234",
  message: "Gostaria de saber mais sobre a clínica.", consent: true,
};

function rows(result: unknown[]) {
  const chain = {
    from: () => chain, innerJoin: () => chain, where: () => chain,
    orderBy: () => chain, limit: async () => result,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}
function selectResults(...results: unknown[][]) {
  for (const result of results) mocks.select.mockReturnValueOnce(rows(result));
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (callback) => callback({
    select: mocks.select, insert: mocks.insert, execute: mocks.execute,
  }));
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockResolvedValue(undefined);
});
describe("public clinic contact requests", () => {
  it.each([
    { consent: false }, { name: "  " }, { contact: "invalid" }, { contact: "visitor@test.invalid" },
    { contact: "(11) 1234-567" }, { contact: "1".repeat(25) },
    { message: "  " }, { message: "x".repeat(2001) },
  ])("validates request fields: %j", async (fields) => {
    expect((await request(app).post("/public/clinics/demo/contact-requests").send({ ...body, ...fields })).status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects unpublished pages", async () => {
    selectResults([]);
    expect((await request(app).post("/public/clinics/demo/contact-requests").send(body)).status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("persists a new clinic-scoped lead with the visitor's message", async () => {
    selectResults([page], [{ userId: 17 }], []);
    const response = await request(app).post("/public/clinics/demo/contact-requests").send(body);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ received: true });
    expect(mocks.values).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      clinicId: 3, authorUserId: 17, name: body.name, contact: body.contact,
      source: "Recado pela página pública", status: "novo",
      notes: expect.stringContaining(body.message),
    }));
  });
  it("deduplicates retries of the same request", async () => {
    selectResults([page], [{ userId: 17 }], [{ id: 1 }]);
    expect((await request(app).post("/public/clinics/demo/contact-requests").send(body)).status).toBe(201);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("reports unavailable reception explicitly instead of pretending success", async () => {
    selectResults([page], []);
    expect((await request(app).post("/public/clinics/demo/contact-requests").send(body)).status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("retires the old appointment endpoints", async () => {
    expect((await request(app).get("/public/clinics/demo/appointment-slots")).status).toBe(410);
    expect((await request(app).post("/public/clinics/demo/appointment-requests").send(body)).status).toBe(410);
  });
});
