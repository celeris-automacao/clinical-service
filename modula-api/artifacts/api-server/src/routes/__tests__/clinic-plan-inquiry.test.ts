import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  transaction: vi.fn(),
  requireAuth: vi.fn(),
  resolveOwnerClinicId: vi.fn(),
  sendEnterprisePlanInquiryEmail: vi.fn(),
  leadsTable: {},
  commercialLeadsTable: {},
  clinicsTable: { id: "clinics.id", name: "clinics.name" },
  usersTable: {
    email: "users.email",
    role: "users.role",
    deactivatedAt: "users.deactivatedAt",
  },
}));

vi.mock("@workspace/db", () => ({
  db: { select: mocks.select, transaction: mocks.transaction },
  clinicSettingsTable: {},
  doctorsTable: {},
  clinicsTable: mocks.clinicsTable,
  usersTable: mocks.usersTable,
  leadsTable: mocks.leadsTable,
  commercialLeadsTable: mocks.commercialLeadsTable,
  PLAN_DOCTOR_LIMITS: {},
  PLAN_LABELS: {},
  PLAN_PRICES: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (...conditions: unknown[]) => conditions,
  isNull: (value: unknown) => value,
  sql: vi.fn(),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: mocks.requireAuth,
  isError: (result: { error?: unknown }) => "error" in result,
  resolveOwnerClinicId: mocks.resolveOwnerClinicId,
}));

vi.mock("../../lib/email", () => ({
  sendEnterprisePlanInquiryEmail: mocks.sendEnterprisePlanInquiryEmail,
}));

import clinicSettingsRouter from "../clinic-settings";

const owner = {
  id: 11,
  role: "clinic_owner",
  name: "Clinic Owner",
  email: "owner@clinic.example",
};
const clinic = { name: "Clínica Exemplo" };
const admins = [{ email: "admin@modula.example" }];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { log: { error: vi.fn(), warn: vi.fn() } });
    next();
  });
  app.use(clinicSettingsRouter);
  return app;
}

function setupSelectResults(adminRows = admins) {
  mocks.select.mockImplementation(() => ({
    from: (table: unknown) => ({
      where: () => table === mocks.clinicsTable
        ? { limit: vi.fn().mockResolvedValue([clinic]) }
        : Promise.resolve(adminRows),
    }),
  }));
}

describe("POST /clinic/plan-inquiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PLAN_INQUIRY_EMAIL", "");
    mocks.requireAuth.mockResolvedValue({ user: owner, clinicId: 7 });
    mocks.resolveOwnerClinicId.mockResolvedValue(7);
    mocks.sendEnterprisePlanInquiryEmail.mockResolvedValue("email-accepted-123");
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback({ insert: mocks.insert }));
    setupSelectResults();
  });

  it("records the request in the clinic and platform commercial leads and notifies active administrators", async () => {
    const response = await request(buildApp())
      .post("/clinic/plan-inquiry")
      .send({ message: "We have two clinics." });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true });
    expect(mocks.insert).toHaveBeenCalledWith(mocks.leadsTable);
    expect(mocks.insert).toHaveBeenCalledWith(mocks.commercialLeadsTable);
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: 7, authorUserId: owner.id, name: owner.name, contact: owner.email,
      source: "Solicitação de upgrade Enterprise", status: "novo",
      notes: expect.stringContaining("We have two clinics."),
    }));
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({
      type: "enterprise_upgrade", clinicId: 7, name: owner.name, email: owner.email,
      status: "novo", message: "We have two clinics.",
    }));
    expect(mocks.sendEnterprisePlanInquiryEmail).toHaveBeenCalledWith({
      to: ["admin@modula.example"],
      clinicName: "Clínica Exemplo",
      ownerName: owner.name,
      ownerEmail: owner.email,
      message: "We have two clinics.",
    });
  });

  it("uses configured recipients when provided", async () => {
    vi.stubEnv("PLAN_INQUIRY_EMAIL", "sales@modula.example, admin@modula.example");

    const response = await request(buildApp())
      .post("/clinic/plan-inquiry")
      .send({});

    expect(response.status).toBe(202);
    expect(mocks.sendEnterprisePlanInquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["sales@modula.example", "admin@modula.example"] }),
    );
  });

  it("records the request even when there is no administrator email recipient", async () => {
    setupSelectResults([]);

    const response = await request(buildApp())
      .post("/clinic/plan-inquiry")
      .send({});

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true });
    expect(mocks.insert).toHaveBeenCalledWith(mocks.commercialLeadsTable);
    expect(mocks.sendEnterprisePlanInquiryEmail).not.toHaveBeenCalled();
  });

  it("keeps the saved lead successful if the optional email notification fails", async () => {
    mocks.sendEnterprisePlanInquiryEmail.mockRejectedValue(new Error("provider unavailable"));

    const response = await request(buildApp())
      .post("/clinic/plan-inquiry")
      .send({});

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true });
    expect(mocks.insert).toHaveBeenCalledWith(mocks.commercialLeadsTable);
    expect(response.body.sent).toBeUndefined();
  });

  it("rejects non-owners without looking up recipients or sending mail", async () => {
    mocks.requireAuth.mockResolvedValue({
      user: { ...owner, role: "profissional_saude" },
      clinicId: 7,
    });

    const response = await request(buildApp())
      .post("/clinic/plan-inquiry")
      .send({});

    expect(response.status).toBe(403);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.sendEnterprisePlanInquiryEmail).not.toHaveBeenCalled();
  });
});
