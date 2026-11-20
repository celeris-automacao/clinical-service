import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  requireAuth: vi.fn(),
  resolveOwnerClinicId: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: { select: mocks.select, update: mocks.update },
  usersTable: {},
  secretariesTable: {},
  doctorsTable: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: mocks.requireAuth,
  isError: (value: unknown) => Boolean(value && typeof value === "object" && "error" in value),
  resolveOwnerClinicId: mocks.resolveOwnerClinicId,
  resolveSecretaryClinicId: vi.fn(),
}));

vi.mock("../../lib/jwt", () => ({
  hashPassword: vi.fn(),
}));

import secretariesRouter from "../secretaries";

function selectChain<T>(rows: T[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(secretariesRouter);
  return app;
}

describe("PATCH /secretaries/:secretaryId avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      user: { id: 8, role: "clinic_owner" },
      clinicId: 12,
    });
    mocks.resolveOwnerClinicId.mockResolvedValue(12);
  });

  it("saves and returns the photo when editing an existing secretary", async () => {
    const secretary = {
      id: 3,
      userId: 22,
      clinicId: 12,
      phone: null,
      cpf: null,
      rg: null,
      birthDate: null,
      salary: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const updatedUser = {
      id: 22,
      name: "Ana Secretária",
      email: "ana@example.com",
      avatarUrl: "/objects/secretary-photo.webp",
      deactivatedAt: null,
    };

    mocks.select
      .mockReturnValueOnce(selectChain([secretary]))
      .mockReturnValueOnce(selectChain([secretary]))
      .mockReturnValueOnce(selectChain([updatedUser]));
    const updateWhere = vi.fn().mockResolvedValue([]);
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    mocks.update.mockReturnValue({ set: updateSet });

    const response = await request(buildApp())
      .patch("/secretaries/3")
      .send({ avatarUrl: updatedUser.avatarUrl });

    expect(response.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl: updatedUser.avatarUrl }),
    );
    expect(response.body.avatarUrl).toBe(updatedUser.avatarUrl);
  });
});
