import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ────────────────────────

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: vi.fn((...args: Parameters<typeof actual.eq>) => actual.eq(...args)) };
});

vi.mock("@workspace/db", () => {
  // SELECT chain: db.select().from(t) → { limit, where }
  //                                      .where(c) → { limit }
  // This supports both db.select().from(t).limit(n) and
  // db.select().from(t).where(c).limit(n).
  const mockSelectLimit = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
  const mockFrom = vi.fn(() => ({ limit: mockSelectLimit, where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  const mockReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  // UPDATE chain: db.update(t).set(d).where(c) → Promise<[]>
  const mockUpdateWhere = vi.fn().mockResolvedValue([]);
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  return {
    db: { select: mockSelect, insert: mockInsert, update: mockUpdate },
    clinicSettingsTable: {},
    clinicsTable: {},
    doctorsTable: {},
    PLAN_DOCTOR_LIMITS: {},
    PLAN_LABELS: {},
    PLAN_PRICES: {},
  };
});

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  // resolveOwnerClinicId is called by resolveClinicId inside the route.
  // Return null so the route uses the legacy singleton path (no clinicId).
  resolveOwnerClinicId: vi.fn().mockResolvedValue(null),
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, resolveOwnerClinicId } from "../../lib/auth-helpers";
import clinicSettingsRouter from "../clinic-settings";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(clinicSettingsRouter);
  return app;
}

const OWNER_USER = {
  id: 1,
  role: "clinic_owner" as const,
  email: "owner@clinic.com",
  name: "Owner",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DOCTOR_USER = {
  id: 2,
  role: "profissional_saude" as const,
  email: "doctor@clinic.com",
  name: "Doctor",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PATIENT_USER = {
  id: 3,
  role: "patient" as const,
  email: "patient@clinic.com",
  name: "Patient",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const EXISTING_SETTINGS = {
  id: 1,
  plan: "basic" as const,
  clinicName: "Test Clinic",
  logoUrl: null as string | null,
  updatedAt: new Date(),
  brandingVersion: 1,
};

function setupDbForUpdate(returnedLogoUrl: string | null, brandingVersion = 2) {
  const updatedSettings = { ...EXISTING_SETTINGS, logoUrl: returnedLogoUrl, brandingVersion };

  // SELECT chain: supports both .from(t).limit(n) and .from(t).where(c).limit(n)
  const mockSelectLimit = vi.fn().mockResolvedValue([updatedSettings]);
  const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
  const mockFrom = vi.fn(() => ({ limit: mockSelectLimit, where: mockSelectWhere }));
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

  // UPDATE chain: db.update(t).set(d).where(c) → resolves to []
  const mockUpdateWhere = vi.fn().mockResolvedValue([]);
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

  return { mockSet, mockUpdateWhere };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PATCH /clinic/branding — logoUrl validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("accepts a valid /objects/... path and persists it", async () => {
    const validPath = "/objects/logos/my-clinic.png";
    setupDbForUpdate(validPath);

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ logoUrl: validPath });

    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toBe(validPath);
    expect(db.update).toHaveBeenCalled();
  });

  it("rejects an arbitrary external URL with 400 and the specific error message", async () => {
    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ logoUrl: "https://evil.com/logo.png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "logoUrl inválido: deve ser um caminho de object storage (começa com /objects/)"
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it("accepts null (clearing the logo) with 200", async () => {
    setupDbForUpdate(null);

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ logoUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.logoUrl).toBeNull();
    expect(db.update).toHaveBeenCalled();
  });
});

describe("PATCH /clinic/branding — clinicName validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("rejects an empty clinicName with 400", async () => {
    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "" });

    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only clinicName with 400", async () => {
    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "   " });

    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("accepts a valid non-empty clinicName and returns it in the response", async () => {
    const updatedSettings = { ...EXISTING_SETTINGS, clinicName: "Clínica São João - Coração Íris" };
    const mockSelectLimit = vi.fn().mockResolvedValue([updatedSettings]);
    const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
    const mockFrom = vi.fn(() => ({ limit: mockSelectLimit, where: mockSelectWhere }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const mockUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Clínica São João - Coração Íris" });

    expect(res.status).toBe(200);
    expect(res.body.clinicName).toBe("Clínica São João - Coração Íris");
    expect(db.update).toHaveBeenCalled();
  });
});

describe("PATCH /clinic/branding — role authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when the caller has role profissional_saude", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Hacked Clinic" });

    expect(res.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller has role patient", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: PATIENT_USER });

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Hacked Clinic" });

    expect(res.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /clinic/branding — version increment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("always passes brandingVersion increment in the db.update payload", async () => {
    const { mockSet } = setupDbForUpdate(null, 2);

    await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Nova Clínica" });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ brandingVersion: expect.anything() })
    );
  });

  it("returns version from the post-update settings fetch", async () => {
    setupDbForUpdate(null, 3);

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Clínica Atualizada" });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
  });

  it("version increments monotonically across successive PATCHes", async () => {
    // First PATCH: simulate DB returning brandingVersion = 2
    setupDbForUpdate(null, 2);
    const res1 = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Versão 2" });
    expect(res1.status).toBe(200);
    expect(res1.body.version).toBe(2);

    // Second PATCH: simulate DB returning brandingVersion = 3
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
    setupDbForUpdate(null, 3);
    const res2 = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Versão 3" });
    expect(res2.status).toBe(200);
    expect(res2.body.version).toBe(3);

    expect(res2.body.version).toBeGreaterThan(res1.body.version);
  });

  it("clearing a legal link field (null) still increments version", async () => {
    setupDbForUpdate(null, 4);

    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ privacyPolicyUrl: null });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(4);
    expect(db.update).toHaveBeenCalled();
  });
});

// ── GET /clinic/branding ──────────────────────────────────────────────────────

const BASE_SETTINGS = {
  id: 1,
  plan: "basic" as const,
  clinicName: "Test Clinic",
  logoUrl: null as string | null,
  senderName: null as string | null,
  fromEmail: null as string | null,
  replyToEmail: null as string | null,
  privacyPolicyUrl: null as string | null,
  termsUrl: null as string | null,
  copyrightUrl: null as string | null,
  contactUrl: null as string | null,
  deletionRequestUrl: null as string | null,
  brandingVersion: 1,
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

/**
 * Sets up db.select to handle the .from().where().limit() chain used by
 * getOrCreateSettings (legacy singleton path, no clinicId query param).
 */
function setupDbForGet(settings: typeof BASE_SETTINGS) {
  const mockLimit = vi.fn().mockResolvedValue([settings]);
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, limit: mockLimit }));
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });
}

describe("GET /clinic/branding — version field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns version from clinicSettingsTable.brandingVersion", async () => {
    const settingsWithVersion = { ...EXISTING_SETTINGS, brandingVersion: 5 };
    const mockSelectLimit = vi.fn().mockResolvedValue([settingsWithVersion]);
    const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
    const mockFrom = vi.fn(() => ({ limit: mockSelectLimit, where: mockSelectWhere }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(5);
  });
});

describe("GET /clinic/branding — returns custom URL fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns custom privacyPolicyUrl when set in settings", async () => {
    const customUrl = "https://custom.clinic.com/politica-privacidade";
    setupDbForGet({ ...BASE_SETTINGS, privacyPolicyUrl: customUrl });

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.privacyPolicyUrl).toBe(customUrl);
  });

  it("returns custom termsUrl when set in settings", async () => {
    const customUrl = "https://custom.clinic.com/termos-de-uso";
    setupDbForGet({ ...BASE_SETTINGS, termsUrl: customUrl });

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.termsUrl).toBe(customUrl);
  });

  it("returns custom copyrightUrl and contactUrl when set", async () => {
    setupDbForGet({
      ...BASE_SETTINGS,
      copyrightUrl: "https://custom.clinic.com/direitos",
      contactUrl: "https://custom.clinic.com/contato",
    });

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.copyrightUrl).toBe("https://custom.clinic.com/direitos");
    expect(res.body.contactUrl).toBe("https://custom.clinic.com/contato");
  });

  it("returns null for URL fields that are not configured", async () => {
    setupDbForGet(BASE_SETTINGS);

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.privacyPolicyUrl).toBeNull();
    expect(res.body.termsUrl).toBeNull();
    expect(res.body.copyrightUrl).toBeNull();
    expect(res.body.contactUrl).toBeNull();
    expect(res.body.deletionRequestUrl).toBeNull();
  });

  it("includes all five URL fields in the response shape", async () => {
    const settings = {
      ...BASE_SETTINGS,
      privacyPolicyUrl: "https://clinic.com/privacidade",
      termsUrl: "https://clinic.com/termos",
      copyrightUrl: "https://clinic.com/direitos",
      contactUrl: "https://clinic.com/contato",
      deletionRequestUrl: "https://clinic.com/exclusao",
    };
    setupDbForGet(settings);

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      privacyPolicyUrl: "https://clinic.com/privacidade",
      termsUrl: "https://clinic.com/termos",
      copyrightUrl: "https://clinic.com/direitos",
      contactUrl: "https://clinic.com/contato",
      deletionRequestUrl: "https://clinic.com/exclusao",
    });
  });

  it("returns the branding version field", async () => {
    setupDbForGet({ ...BASE_SETTINGS, brandingVersion: 4 });

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(4);
  });

  it("returns the clinic name and updatedAt in the response", async () => {
    setupDbForGet({
      ...BASE_SETTINGS,
      clinicName: "Minha Clínica",
      updatedAt: new Date("2025-06-15T10:00:00Z"),
    });

    const res = await request(buildApp()).get("/clinic/branding");

    expect(res.status).toBe(200);
    expect(res.body.clinicName).toBe("Minha Clínica");
    expect(res.body.updatedAt).toBe("2025-06-15T10:00:00.000Z");
  });
});

// ── Version sync: GET → PATCH (web cockpit form) → GET ────────────────────────

describe("PATCH /clinic/branding — version sync round-trip (web cockpit form)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: OWNER_USER });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it("GET after PATCH returns a higher version than GET before PATCH", async () => {
    const app = buildApp();
    const v1Settings = { ...BASE_SETTINGS, brandingVersion: 1 };
    const v2Settings = { ...BASE_SETTINGS, brandingVersion: 2 };

    // Three db.select calls in order:
    //   [0] GET /clinic/branding (before PATCH) → v1
    //   [1] getOrCreateSettings inside PATCH handler (post-update read-back) → v2
    //   [2] GET /clinic/branding (after PATCH) → v2
    const selectResults = [v1Settings, v2Settings, v2Settings];
    let selectCallIdx = 0;

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const settings = selectResults[selectCallIdx++] ?? v2Settings;
      const mockLimit = vi.fn().mockResolvedValue([settings]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      return { from: vi.fn(() => ({ where: mockWhere, limit: mockLimit })) };
    });

    // Update chain: db.update(t).set(d).where(c) → resolves to []
    const mockUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    // 1. GET before PATCH — capture baseline version
    const getBeforeRes = await request(app).get("/clinic/branding");
    expect(getBeforeRes.status).toBe(200);
    const versionBefore: number = getBeforeRes.body.version;
    expect(versionBefore).toBe(1);

    // 2. PATCH as clinic_owner (simulates web cockpit branding form submit)
    const patchRes = await request(app)
      .patch("/clinic/branding")
      .send({ clinicName: "Clínica Atualizada" });
    expect(patchRes.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
    // The update payload must include a brandingVersion increment expression
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ brandingVersion: expect.anything() })
    );

    // 3. GET after PATCH — version must be strictly greater than before
    const getAfterRes = await request(app).get("/clinic/branding");
    expect(getAfterRes.status).toBe(200);
    expect(getAfterRes.body.version).toBeGreaterThan(versionBefore);
    expect(getAfterRes.body.version).toBe(2);
  });

  it("version increments when only a legal-link field is cleared (null)", async () => {
    const app = buildApp();
    const v3Settings = { ...BASE_SETTINGS, brandingVersion: 3, privacyPolicyUrl: "https://clinic.com/privacidade" };
    const v4Settings = { ...BASE_SETTINGS, brandingVersion: 4, privacyPolicyUrl: null };

    const selectResults = [v3Settings, v4Settings, v4Settings];
    let selectCallIdx = 0;

    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const settings = selectResults[selectCallIdx++] ?? v4Settings;
      const mockLimit = vi.fn().mockResolvedValue([settings]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      return { from: vi.fn(() => ({ where: mockWhere, limit: mockLimit })) };
    });

    const mockUpdateWhere = vi.fn().mockResolvedValue([]);
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn(() => ({ where: mockUpdateWhere })),
    });

    const getBeforeRes = await request(app).get("/clinic/branding");
    expect(getBeforeRes.status).toBe(200);
    const versionBefore: number = getBeforeRes.body.version;

    const patchRes = await request(app)
      .patch("/clinic/branding")
      .send({ privacyPolicyUrl: null });
    expect(patchRes.status).toBe(200);

    const getAfterRes = await request(app).get("/clinic/branding");
    expect(getAfterRes.status).toBe(200);
    expect(getAfterRes.body.version).toBeGreaterThan(versionBefore);
  });

  it("non-owner (doctor) cannot increment the version", async () => {
    const app = buildApp();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });

    const v1Settings = { ...BASE_SETTINGS, brandingVersion: 1 };
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const mockLimit = vi.fn().mockResolvedValue([v1Settings]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      return { from: vi.fn(() => ({ where: mockWhere, limit: mockLimit })) };
    });

    // Attempt PATCH as doctor — must be rejected
    const patchRes = await request(app)
      .patch("/clinic/branding")
      .send({ clinicName: "Tentativa indevida" });
    expect(patchRes.status).toBe(403);
    expect(db.update).not.toHaveBeenCalled();

    // GET still returns the original version unchanged
    const getAfterRes = await request(app).get("/clinic/branding");
    expect(getAfterRes.status).toBe(200);
    expect(getAfterRes.body.version).toBe(1);
  });
});

// ── GET /clinic/branding?clinicId=X — per-clinic scoping ─────────────────────

// eq is wrapped with vi.fn() by the drizzle-orm vi.mock above, so we can
// inspect its call arguments directly without vi.spyOn.
const eqMock = eq as ReturnType<typeof vi.fn>;

// ── PATCH /clinic/branding — multi-clinic owner write scoping ─────────────────
//
// A clinic_owner who owns multiple clinics must only ever write to the clinic
// resolved from their JWT (via resolveOwnerClinicId). The request body must
// never influence which clinic row is targeted.

const OWNER_USER_A = {
  id: 10,
  role: "clinic_owner" as const,
  email: "owner-a@clinic.com",
  name: "Owner A",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const OWNER_USER_B = {
  id: 20,
  role: "clinic_owner" as const,
  email: "owner-b@clinic.com",
  name: "Owner B",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Helper: resolve exactly which eq() call fed the UPDATE's .where() ─────────
//
// PATCH /clinic/branding calls:
//   1. db.update(...).set(...).where(eq(clinicSettingsTable.clinicId, clinicId))
//   2. db.select(...).from(...).where(eq(clinicSettingsTable.clinicId, clinicId))  ← getOrCreateSettings
//
// Both produce an eq() call with the same clinicId. A naive `.find(val === id)`
// on eqMock.mock.calls passes even when UPDATE targeted the wrong clinic, because
// the later SELECT always uses the JWT clinicId.
//
// Instead we use reference equality: eqMock calls through to the real eq() and
// returns the predicate object. mockUpdateWhere is called with that exact object.
// By matching the predicate reference we can identify which eq() invocation
// produced the WHERE clause used specifically by the UPDATE statement.

function getUpdateWhereClinicId(
  mockUpdateWhere: ReturnType<typeof vi.fn>
): unknown {
  // The predicate object passed to db.update(...).set(...).where(predicate)
  const updatePredicate: unknown = mockUpdateWhere.mock.calls[0]?.[0];
  if (updatePredicate === undefined) return undefined;

  // Find which eqMock call produced exactly this predicate object
  const eqCallIdx = eqMock.mock.results.findIndex(
    (r) => r.value === updatePredicate
  );
  if (eqCallIdx === -1) return undefined;

  // Second argument to eq(column, value) is the scoping value (the clinicId)
  return (eqMock.mock.calls[eqCallIdx] as [unknown, unknown])[1];
}

describe("PATCH /clinic/branding — multi-clinic owner write scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always writes to the JWT-derived clinicId — ignoring any extra fields in the request body", async () => {
    // resolveOwnerClinicId resolves clinic 1 for this owner's JWT.
    // The request body includes a rogue `clinicId: 999` field — the handler
    // must ignore it entirely and write to clinic 1 only.
    const JWT_CLINIC_ID = 1;
    const ROGUE_CLINIC_ID = 999;

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER_A,
      clinicId: JWT_CLINIC_ID,
    });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(JWT_CLINIC_ID);

    const settings = { ...BASE_SETTINGS, id: JWT_CLINIC_ID, clinicName: "Clínica A" };
    const mockSelectLimit = vi.fn().mockResolvedValue([settings]);
    const mockSelectWhere = vi.fn(() => ({ limit: mockSelectLimit }));
    const mockFrom = vi.fn(() => ({ limit: mockSelectLimit, where: mockSelectWhere }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const mockUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

    // Send an adversarial body: extra `clinicId` field targeting a different clinic
    const res = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Clínica Atualizada", clinicId: ROGUE_CLINIC_ID });

    expect(res.status).toBe(200);
    expect(mockUpdateWhere).toHaveBeenCalledOnce();

    // Verify the WHERE predicate passed to UPDATE was built with the JWT-derived
    // clinicId (1), not with the rogue value from the request body (999).
    const updateClinicId = getUpdateWhereClinicId(mockUpdateWhere);
    expect(updateClinicId).toBe(JWT_CLINIC_ID);
    expect(updateClinicId).not.toBe(ROGUE_CLINIC_ID);
  });

  it("two owners each updating their own clinic's branding write only to their own row", async () => {
    const CLINIC_A_ID = 10;
    const CLINIC_B_ID = 20;

    // ── Owner A patches clinic 10 ───────────────────────────────────────────
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER_A,
      clinicId: CLINIC_A_ID,
    });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(CLINIC_A_ID);

    const settingsA = { ...BASE_SETTINGS, id: CLINIC_A_ID, clinicName: "Clínica A" };
    const mockSelectLimitA = vi.fn().mockResolvedValue([settingsA]);
    const mockSelectWhereA = vi.fn(() => ({ limit: mockSelectLimitA }));
    const mockFromA = vi.fn(() => ({ limit: mockSelectLimitA, where: mockSelectWhereA }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFromA });

    const mockUpdateWhereA = vi.fn().mockResolvedValue([]);
    const mockSetA = vi.fn(() => ({ where: mockUpdateWhereA }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSetA });

    const resA = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Clínica A Atualizada" });

    expect(resA.status).toBe(200);
    expect(mockUpdateWhereA).toHaveBeenCalledOnce();

    // The UPDATE WHERE clause for owner A must use clinicId=10 specifically,
    // not the rogue value 20 (owner B's clinic). This uses reference equality
    // to avoid the false-positive from the post-update SELECT's eq() call.
    const updateClinicIdA = getUpdateWhereClinicId(mockUpdateWhereA);
    expect(updateClinicIdA).toBe(CLINIC_A_ID);
    expect(updateClinicIdA).not.toBe(CLINIC_B_ID);

    // ── Owner B patches clinic 20 (independent request with its own mocks) ─
    vi.clearAllMocks();

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: OWNER_USER_B,
      clinicId: CLINIC_B_ID,
    });
    (resolveOwnerClinicId as ReturnType<typeof vi.fn>).mockResolvedValue(CLINIC_B_ID);

    const settingsB = { ...BASE_SETTINGS, id: CLINIC_B_ID, clinicName: "Clínica B" };
    const mockSelectLimitB = vi.fn().mockResolvedValue([settingsB]);
    const mockSelectWhereB = vi.fn(() => ({ limit: mockSelectLimitB }));
    const mockFromB = vi.fn(() => ({ limit: mockSelectLimitB, where: mockSelectWhereB }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFromB });

    const mockUpdateWhereB = vi.fn().mockResolvedValue([]);
    const mockSetB = vi.fn(() => ({ where: mockUpdateWhereB }));
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSetB });

    const resB = await request(buildApp())
      .patch("/clinic/branding")
      .send({ clinicName: "Clínica B Atualizada" });

    expect(resB.status).toBe(200);
    expect(mockUpdateWhereB).toHaveBeenCalledOnce();

    // Owner B's UPDATE WHERE clause must use clinicId=20, not clinic A's 10.
    const updateClinicIdB = getUpdateWhereClinicId(mockUpdateWhereB);
    expect(updateClinicIdB).toBe(CLINIC_B_ID);
    expect(updateClinicIdB).not.toBe(CLINIC_A_ID);

    // Confirm the two owners' UPDATE clauses targeted strictly different clinics
    expect(updateClinicIdA).not.toBe(updateClinicIdB);
  });
});

describe("GET /clinic/branding — clinicId query param scopes the DB predicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the DB where-clause with eq(clinicId) — not the IS NULL singleton predicate", async () => {
    const clinicSettings = {
      ...BASE_SETTINGS,
      id: 10,
      clinicName: "Clínica Scoped",
      privacyPolicyUrl: "https://clinica-scoped.com/privacidade",
    };
    const mockLimit = vi.fn().mockResolvedValue([clinicSettings]);
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere, limit: mockLimit }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

    const res = await request(buildApp()).get("/clinic/branding?clinicId=7");

    expect(res.status).toBe(200);
    expect(res.body.privacyPolicyUrl).toBe("https://clinica-scoped.com/privacidade");

    // eq() must have been called with the clinicId value (7) from the query param.
    // If the handler ignored clinicId and fell back to the IS NULL singleton path,
    // eq() would not be called with 7 and this assertion would fail.
    const callWithClinicId = eqMock.mock.calls.find(([, val]: [unknown, unknown]) => val === 7);
    expect(callWithClinicId).toBeDefined();
  });

  it("two clinics with different privacyPolicyUrls each scope eq() to their own clinicId", async () => {
    // — Clinic A (clinicId=1) —
    const clinicASettings = {
      ...BASE_SETTINGS,
      id: 10,
      clinicName: "Clínica A",
      privacyPolicyUrl: "https://clinica-a.com/privacidade",
    };
    const mockLimitA = vi.fn().mockResolvedValue([clinicASettings]);
    const mockWhereA = vi.fn(() => ({ limit: mockLimitA }));
    const mockFromA = vi.fn(() => ({ where: mockWhereA, limit: mockLimitA }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFromA });

    const resA = await request(buildApp()).get("/clinic/branding?clinicId=1");
    expect(resA.status).toBe(200);
    expect(resA.body.privacyPolicyUrl).toBe("https://clinica-a.com/privacidade");

    // eq() for clinic A must use clinicId=1 as the scoping value
    const callWithId1 = eqMock.mock.calls.find(([, val]: [unknown, unknown]) => val === 1);
    expect(callWithId1).toBeDefined();

    // — Clinic B (clinicId=2) —
    vi.clearAllMocks();

    const clinicBSettings = {
      ...BASE_SETTINGS,
      id: 20,
      clinicName: "Clínica B",
      privacyPolicyUrl: "https://clinica-b.com/privacidade",
    };
    const mockLimitB = vi.fn().mockResolvedValue([clinicBSettings]);
    const mockWhereB = vi.fn(() => ({ limit: mockLimitB }));
    const mockFromB = vi.fn(() => ({ where: mockWhereB, limit: mockLimitB }));
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFromB });

    const resB = await request(buildApp()).get("/clinic/branding?clinicId=2");
    expect(resB.status).toBe(200);
    expect(resB.body.privacyPolicyUrl).toBe("https://clinica-b.com/privacidade");

    // eq() for clinic B must use clinicId=2 as the scoping value
    const callWithId2 = eqMock.mock.calls.find(([, val]: [unknown, unknown]) => val === 2);
    expect(callWithId2).toBeDefined();

    // Cross-assertion: the two clinics' URLs are distinct — no data bleed
    expect(resA.body.privacyPolicyUrl).not.toBe(resB.body.privacyPolicyUrl);
  });

  it("singleton IS NULL path is not reached when a valid clinicId is provided", async () => {
    const CLINIC_URL = "https://clinica-especifica.com/privacidade";
    const SINGLETON_URL = "https://singleton-fallback.com/privacidade";

    const clinicSettings = { ...BASE_SETTINGS, id: 10, privacyPolicyUrl: CLINIC_URL };
    const singletonSettings = { ...BASE_SETTINGS, id: 1, privacyPolicyUrl: SINGLETON_URL };

    // First db.select() call → per-clinic branch
    const mockLimitClinic = vi.fn().mockResolvedValue([clinicSettings]);
    const mockWhereClinic = vi.fn(() => ({ limit: mockLimitClinic }));
    const mockFromClinic = vi.fn(() => ({ where: mockWhereClinic, limit: mockLimitClinic }));

    // Any subsequent db.select() call → singleton branch (should never be reached)
    const mockLimitSingleton = vi.fn().mockResolvedValue([singletonSettings]);
    const mockWhereSingleton = vi.fn(() => ({ limit: mockLimitSingleton }));
    const mockFromSingleton = vi.fn(() => ({ where: mockWhereSingleton, limit: mockLimitSingleton }));

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({ from: mockFromClinic })
      .mockReturnValue({ from: mockFromSingleton });

    const res = await request(buildApp()).get("/clinic/branding?clinicId=10");

    expect(res.status).toBe(200);
    // Must return the clinic-scoped URL, not the singleton URL
    expect(res.body.privacyPolicyUrl).toBe(CLINIC_URL);
    expect(res.body.privacyPolicyUrl).not.toBe(SINGLETON_URL);
    // The singleton chain's where must never have been invoked
    expect(mockWhereSingleton).not.toHaveBeenCalled();
    // eq() must have been called with clinicId=10 (not ignored)
    const callWithId10 = eqMock.mock.calls.find(([, val]: [unknown, unknown]) => val === 10);
    expect(callWithId10).toBeDefined();
  });
});
