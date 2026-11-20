import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock heavy dependencies before any local imports ────────────────────────

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  checkInsTable: {},
  weightEntriesTable: {},
  sabotageNotesTable: {},
  patientsTable: {},
  usersTable: {},
  aiPatientSummariesTable: {},
}));

vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(),
  isError: vi.fn((r: unknown) => "error" in (r as object)),
  ensurePatientAccess: vi.fn(),
}));

// ── Import after mocks are registered ───────────────────────────────────────

import { db } from "@workspace/db";
import { requireAuth, ensurePatientAccess } from "../../lib/auth-helpers";
import { openai } from "@workspace/integrations-openai-ai-server";
import aiAnalysisRouter from "../ai-analysis";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(aiAnalysisRouter);
  return app;
}

/**
 * Build a chainable db.select() mock that resolves with `rows`.
 * Handles both `.where(...).orderBy(...).limit(n)` and `.where(...).limit(n)` chains.
 */
function selectChain(rows: unknown[]) {
  const mockLimit = vi.fn().mockResolvedValueOnce(rows);
  const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy, limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  return { from: mockFrom };
}

const DOCTOR_USER = {
  id: 10,
  role: "profissional_saude" as const,
  email: "doctor@clinic.com",
  name: "Dr. Silva",
  clerkId: null,
  passwordHash: null,
  accessToken: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PATIENT_RECORD = {
  id: 42,
  userId: 99,
  doctorId: 5,
  startWeight: "80.0",
  targetWeight: "70.0",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// A minimal check-in that satisfies the "at least some data" guard in the route.
const SAMPLE_CHECK_IN = {
  id: 1,
  patientId: 42,
  date: "2026-06-15",
  didExercise: true,
  drankWater: true,
  ateWell: true,
  note: null,
  exerciseDescription: null,
  foodCalorieEstimate: null,
  exerciseCalorieEstimate: null,
  xpEarned: 50,
  createdAt: new Date(),
};

const SAVED_SUMMARY = {
  id: 1,
  patientId: 42,
  generatedBy: 10,
  startDate: "2026-06-01",
  endDate: "2026-06-30",
  summaryText: "Paciente mostrou boa adesão ao plano.",
  doctorNotes: null,
  createdAt: new Date("2026-06-30T10:00:00Z"),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /ai/patient-summary + GET /patients/:id/ai-summaries", () => {
  beforeEach(() => {
    // resetAllMocks clears call history AND flushes any leftover mockReturnValueOnce queues.
    vi.resetAllMocks();

    // Re-apply persistent mocks wiped by reset.
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: DOCTOR_USER });
    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(PATIENT_RECORD);
    (openai.chat.completions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [{ message: { content: "Paciente mostrou boa adesão ao plano." } }],
    });
  });

  it("saves a summary when saveSummary=true and the new record appears in the GET list", async () => {
    const app = buildApp();

    // POST route db.select() calls (in order):
    //   1. usersTable — patient user info
    //   2. checkInsTable (Promise.all)
    //   3. weightEntriesTable (Promise.all)
    //   4. sabotageNotesTable (Promise.all)
    //   5. patientsTable (Promise.all)
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(selectChain([{ name: "João Silva", email: "joao@test.com" }]))
      .mockReturnValueOnce(selectChain([SAMPLE_CHECK_IN])) // non-empty → route proceeds past early-exit
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([PATIENT_RECORD]));

    // db.insert() → returns the new summary id.
    const mockReturning = vi.fn().mockResolvedValueOnce([{ id: SAVED_SUMMARY.id }]);
    const mockValues = vi.fn(() => ({ returning: mockReturning }));
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({ values: mockValues });

    // 1. Generate + save a summary.
    const postRes = await request(app)
      .post("/ai/patient-summary")
      .send({ patientId: 42, saveSummary: true });

    expect(postRes.status).toBe(200);
    expect(postRes.body.summary).toBe("Paciente mostrou boa adesão ao plano.");
    expect(postRes.body.savedId).toBe(SAVED_SUMMARY.id);
    expect(db.insert).toHaveBeenCalledOnce();

    // GET route db.select() call:
    //   1. aiPatientSummariesTable → returns the saved record.
    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain([SAVED_SUMMARY]));

    // 2. Fetch summary history — the newly saved record must appear.
    const getRes = await request(app).get("/patients/42/ai-summaries");

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].id).toBe(SAVED_SUMMARY.id);
    expect(getRes.body[0].summaryText).toBe(SAVED_SUMMARY.summaryText);
    expect(getRes.body[0].patientId).toBe(42);
  });

  it("does NOT call db.insert when saveSummary=false and savedId is null", async () => {
    const app = buildApp();

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(selectChain([{ name: "João Silva", email: "joao@test.com" }]))
      .mockReturnValueOnce(selectChain([SAMPLE_CHECK_IN]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([PATIENT_RECORD]));

    const postRes = await request(app)
      .post("/ai/patient-summary")
      .send({ patientId: 42, saveSummary: false });

    expect(postRes.status).toBe(200);
    expect(postRes.body.savedId).toBeNull();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns up to 50 summaries ordered newest-first", async () => {
    const app = buildApp();

    // Build 50 summaries with descending IDs (as the route orders by createdAt DESC).
    const manySummaries = Array.from({ length: 50 }, (_, i) => ({
      ...SAVED_SUMMARY,
      id: 50 - i,
      summaryText: `Resumo ${50 - i}`,
    }));

    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain(manySummaries));

    const getRes = await request(app).get("/patients/42/ai-summaries");

    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body)).toBe(true);
    expect(getRes.body).toHaveLength(50);
    // Newest-first: id 50 at index 0, id 1 at index 49.
    expect(getRes.body[0].id).toBe(50);
    expect(getRes.body[49].id).toBe(1);
  });

  it("returns 404 on GET when the patient does not belong to the doctor", async () => {
    const app = buildApp();

    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const getRes = await request(app).get("/patients/999/ai-summaries");

    expect(getRes.status).toBe(404);
    expect(getRes.body.error).toMatch(/não encontrado|acesso negado/i);
    // db.select should not be called for the summaries query.
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 403 when a patient user tries to list summaries", async () => {
    const app = buildApp();

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { ...DOCTOR_USER, role: "patient" },
    });

    const getRes = await request(app).get("/patients/42/ai-summaries");

    expect(getRes.status).toBe(403);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 403 when a patient user tries to generate a summary", async () => {
    const app = buildApp();

    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { ...DOCTOR_USER, role: "patient" },
    });

    const postRes = await request(app)
      .post("/ai/patient-summary")
      .send({ patientId: 42, saveSummary: true });

    expect(postRes.status).toBe(403);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns 404 on POST when the patient does not belong to the doctor", async () => {
    const app = buildApp();

    (ensurePatientAccess as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    (db.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      selectChain([{ name: "João Silva", email: "joao@test.com" }])
    );

    const postRes = await request(app)
      .post("/ai/patient-summary")
      .send({ patientId: 999, saveSummary: true });

    expect(postRes.status).toBe(404);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
