import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  returning: vi.fn(),
  requireAuth: vi.fn(),
  commercialLeadsTable: {
    id: "commercial_leads.id",
    type: "commercial_leads.type",
    clinicId: "commercial_leads.clinic_id",
    name: "commercial_leads.name",
    email: "commercial_leads.email",
    phone: "commercial_leads.phone",
    message: "commercial_leads.message",
    status: "commercial_leads.status",
    createdAt: "commercial_leads.created_at",
    updatedAt: "commercial_leads.updated_at",
  },
  clinicsTable: { id: "clinics.id", name: "clinics.name" },
}));

vi.mock("@workspace/db", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
  },
  commercialLeadsTable: mocks.commercialLeadsTable,
  clinicsTable: mocks.clinicsTable,
}));
vi.mock("drizzle-orm", () => ({
  desc: (value: unknown) => value,
  eq: (...values: unknown[]) => values,
}));
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: mocks.requireAuth,
  isError: (result: { error?: unknown }) => "error" in result,
}));
import commercialLeadsRouter from "../commercial-leads";

const app = express();
app.use(express.json(), (req, _res, next) => {
  Object.assign(req, { log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } });
  next();
}, commercialLeadsRouter);

function selectRows(result: unknown[]) {
  const chain = {
    from: () => chain,
    leftJoin: () => chain,
    orderBy: async () => result,
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.values.mockReturnValue({ returning: mocks.returning });
  mocks.returning.mockResolvedValue([{ id: 21 }]);
  mocks.update.mockReturnValue({ set: mocks.set });
  mocks.set.mockReturnValue({ where: () => ({ returning: mocks.returning }) });
  mocks.select.mockReturnValue(selectRows([]));
});

describe("public Enterprise inquiries", () => {
  const payload = {
    name: "Ana Exemplo",
    email: "ANA@EXAMPLE.COM",
    phone: "(11) 99999-1234",
    message: "Temos 15 profissionais.",
    consent: true,
  };

  it("saves a new prospect with contact details in the platform commercial queue", async () => {
    const response = await request(app).post("/public/enterprise-inquiries").send(payload);
    expect(response.status).toBe(201);
    expect(response.body.received).toBe(true);
    expect(mocks.insert).toHaveBeenCalledWith(mocks.commercialLeadsTable);
    expect(mocks.values).toHaveBeenCalledWith({
      type: "new_prospect",
      name: payload.name,
      email: "ana@example.com",
      phone: payload.phone,
      message: payload.message,
      status: "novo",
    });
  });

  it.each([
    { name: "A" },
    { email: "invalid" },
    { phone: "123" },
    { consent: false },
  ])("rejects invalid or incomplete contact details: %j", async (fields) => {
    const response = await request(app).post("/public/enterprise-inquiries").send({ ...payload, ...fields });
    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("commercial lead administration", () => {
  it("restricts the commercial inbox to super admins", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { role: "clinic_owner" } });
    const response = await request(app).get("/admin/commercial-leads");
    expect(response.status).toBe(403);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("lists leads for super admins", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { role: "super_admin" } });
    const leads = [{ id: 21, type: "new_prospect", name: "Ana", email: "ana@example.com" }];
    mocks.select.mockReturnValue(selectRows(leads));
    const response = await request(app).get("/admin/commercial-leads");
    expect(response.status).toBe(200);
    expect(response.body).toEqual(leads);
  });

  it("lets a super admin advance a commercial lead", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { role: "super_admin" } });
    const updated = { id: 21, status: "contatado", updatedAt: new Date("2026-10-30T12:00:00Z") };
    mocks.returning.mockResolvedValue([updated]);
    const response = await request(app)
      .patch("/admin/commercial-leads/21/status")
      .send({ status: "contatado" });
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ status: "contatado", updatedAt: expect.any(Date) });
  });

  it("rejects invalid lead statuses", async () => {
    mocks.requireAuth.mockResolvedValue({ user: { role: "super_admin" } });
    const response = await request(app)
      .patch("/admin/commercial-leads/21/status")
      .send({ status: "unknown" });
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
