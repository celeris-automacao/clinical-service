import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(),
}));

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
  secretariesTable: {},
}));

vi.mock("../jwt", () => ({
  verifyAccessToken: vi.fn(),
}));

import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { verifyAccessToken } from "../jwt";
import { authenticateRequest } from "../auth-helpers";

describe("authenticateRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns clerk_unavailable when Clerk context is missing", async () => {
    (getAuth as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("clerkMiddleware() should be registered");
    });
    (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await authenticateRequest({ headers: {}, query: {} } as any);

    expect(result.authenticated).toBe(false);
    if (!result.authenticated) {
      expect(result.reason).toBe("clerk_unavailable");
    }
  });

  it("returns local_jwt when verifyAccessToken succeeds", async () => {
    (verifyAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      sub: "7",
      email: "user@example.com",
      role: "patient",
      clinicId: 3,
    });
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 7,
              clerkId: null,
              email: "user@example.com",
              name: "User",
              role: "patient",
              deactivatedAt: null,
            },
          ]),
        }),
      }),
    });

    const result = await authenticateRequest({
      headers: { authorization: "Bearer jwt-token" },
      query: {},
    } as any);

    expect(result.authenticated).toBe(true);
    if (result.authenticated) {
      expect(result.strategy).toBe("local_jwt");
      expect(result.clinicId).toBe(3);
    }
  });
});
