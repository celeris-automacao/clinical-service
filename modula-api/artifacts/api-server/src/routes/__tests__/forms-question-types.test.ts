import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), insert: vi.fn(), update: vi.fn(), values: vi.fn(), set: vi.fn(),
}));
vi.mock("@workspace/db", () => ({
  db: { select: mocks.select, insert: mocks.insert, update: mocks.update },
  formsTable: {}, formQuestionsTable: {}, formAssignmentsTable: {}, formResponsesTable: {},
  formResponseAnswersTable: {}, patientsTable: {}, patientClinicsTable: {}, clinicOwnersTable: {},
  doctorsTable: {}, secretariesTable: {}, staffEventsTable: {},
}));
vi.mock("../../lib/auth-helpers", () => ({
  requireAuth: vi.fn(async () => ({ user: { id: 1, role: "clinic_owner" }, clinicId: 7 })),
  isError: () => false,
  ensurePatientAccess: vi.fn(),
  resolveOwnerClinicId: vi.fn(async () => 7),
}));
import formsRouter from "../forms";

const app = express();
app.use(express.json(), formsRouter);
const question = { id: 10, formId: 1, text: "Atividades?", questionType: "yes_no", options: null, orderIndex: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.select.mockImplementation(() => ({
    from: () => ({ where: () => ({
      limit: async () => [{ ...question, clinicId: 7 }],
      then: (resolve: (value: unknown) => void) => resolve([{ maxIdx: 0 }]),
    }) }),
  }));
  mocks.values.mockImplementation((value) => ({ returning: async () => [{ id: 10, ...value }] }));
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.set.mockImplementation((value) => ({ where: () => ({ returning: async () => [{ ...question, ...value }] }) }));
  mocks.update.mockReturnValue({ set: mocks.set });
});

describe("Form question types", () => {
  it.each(["yes_no", "text", "multiple_choice"])("creates a %s question", async (questionType) => {
    const response = await request(app).post("/forms/1/questions").send({
      text: " Nova pergunta ", questionType, options: ["Caminhada", "Natação"],
    });
    expect(response.status).toBe(201);
    expect(response.body.questionType).toBe(questionType);
    expect(response.body.text).toBe("Nova pergunta");
    expect(response.body.options).toEqual(questionType === "multiple_choice" ? ["Caminhada", "Natação"] : null);
  });

  it("updates type and alternatives without replacing the question", async () => {
    const response = await request(app).patch("/forms/1/questions/10").send({
      questionType: "multiple_choice", options: ["Caminhada", "Natação"],
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 10, questionType: "multiple_choice", options: ["Caminhada", "Natação"] });
  });

  it("clears alternatives when switching to text", async () => {
    const response = await request(app).patch("/forms/1/questions/10").send({ questionType: "text" });
    expect(response.status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith({ questionType: "text", options: null });
  });

  it.each([undefined, [], ["Única"], ["A", " A "], [" ", "B"], ["A|B", "C"]])("rejects invalid multiple-choice options: %j", async (options) => {
    for (const method of ["post", "patch"] as const) {
      const path = method === "post" ? "/forms/1/questions" : "/forms/1/questions/10";
      const response = await request(app)[method](path).send({ text: "Pergunta", questionType: "multiple_choice", options });
      expect(response.status).toBe(400);
    }
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
